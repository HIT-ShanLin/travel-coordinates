package sms

import (
	"fmt"

	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	dypnsapi20170525 "github.com/alibabacloud-go/dypnsapi-20170525/v3/client"
	"github.com/alibabacloud-go/tea/tea"
)

type AliyunClient struct {
	client *dypnsapi20170525.Client
}

func New(accessKeyID, accessKeySecret string) *AliyunClient {
	cfg := &openapi.Config{
		AccessKeyId:     tea.String(accessKeyID),
		AccessKeySecret: tea.String(accessKeySecret),
	}
	cfg.Endpoint = tea.String("dypnsapi.aliyuncs.com")
	client, err := dypnsapi20170525.NewClient(cfg)
	if err != nil {
		panic(fmt.Sprintf("create sms client: %v", err))
	}
	return &AliyunClient{client: client}
}

func (c *AliyunClient) Enabled() bool {
	return c.client != nil
}

func (c *AliyunClient) SendCode(phone, signName, templateCode, code string) error {
	req := &dypnsapi20170525.SendSmsVerifyCodeRequest{
		PhoneNumber:   tea.String(phone),
		SignName:      tea.String(signName),
		TemplateCode:  tea.String(templateCode),
		TemplateParam: tea.String(fmt.Sprintf(`{"code":"%s","min":"5"}`, code)),
	}
	resp, err := c.client.SendSmsVerifyCode(req)
	if err != nil {
		return fmt.Errorf("sms send: %w", err)
	}
	if resp.Body != nil && tea.StringValue(resp.Body.Code) != "OK" {
		return fmt.Errorf("sms failed: %s - %s",
			tea.StringValue(resp.Body.Code),
			tea.StringValue(resp.Body.Message))
	}
	return nil
}
