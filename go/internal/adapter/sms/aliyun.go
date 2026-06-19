package sms

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

type AliyunClient struct {
	AccessKeyID     string
	AccessKeySecret string
	SignName        string
	TemplateCode    string
}

func New(accessKeyID, accessKeySecret, signName, templateCode string) *AliyunClient {
	return &AliyunClient{
		AccessKeyID:     accessKeyID,
		AccessKeySecret: accessKeySecret,
		SignName:        signName,
		TemplateCode:    templateCode,
	}
}

func (c *AliyunClient) SendCode(phone, code string) error {
	params := map[string]string{
		"AccessKeyId":      c.AccessKeyID,
		"Action":           "SendSms",
		"Format":           "JSON",
		"PhoneNumbers":     phone,
		"RegionId":         "cn-hangzhou",
		"SignName":         c.SignName,
		"SignatureMethod":  "HMAC-SHA1",
		"SignatureNonce":   fmt.Sprintf("%d", time.Now().UnixNano()),
		"SignatureVersion": "1.0",
		"TemplateCode":     c.TemplateCode,
		"TemplateParam":    fmt.Sprintf(`{"code":"%s"}`, code),
		"Timestamp":        time.Now().UTC().Format("2006-01-02T15:04:05Z"),
		"Version":          "2017-05-25",
	}

	// build signature
	signature := sign("GET", params, c.AccessKeySecret)

	// build query
	q := url.Values{}
	for k, v := range params {
		q.Set(k, v)
	}
	q.Set("Signature", signature)

	urlStr := "https://dysmsapi.aliyuncs.com/?" + q.Encode()

	resp, err := http.Get(urlStr)
	if err != nil {
		return fmt.Errorf("sms send: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Code    string `json:"Code"`
		Message string `json:"Message"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("sms parse response: %w", err)
	}

	if result.Code != "OK" {
		return fmt.Errorf("sms failed: %s - %s", result.Code, result.Message)
	}

	return nil
}

func sign(method string, params map[string]string, secret string) string {
	// sort keys
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	// build query string
	var parts []string
	for _, k := range keys {
		parts = append(parts, url.QueryEscape(k)+"="+url.QueryEscape(params[k]))
	}
	queryStr := strings.ReplaceAll(strings.ReplaceAll(strings.Join(parts, "&"), "+", "%20"), "*", "%2A")

	// string to sign
	strToSign := method + "&" + url.QueryEscape("/") + "&" + url.QueryEscape(queryStr)

	// HMAC-SHA1
	mac := hmac.New(sha1.New, []byte(secret+"&"))
	mac.Write([]byte(strToSign))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}
