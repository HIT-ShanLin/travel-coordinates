CREATE TABLE IF NOT EXISTS geo_suggest_cache (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    keyword       VARCHAR(200) NOT NULL,
    response_json TEXT         NOT NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_keyword (keyword)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS geo_reverse_cache (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    coord_hash    VARCHAR(64)  NOT NULL,
    lat           DOUBLE       NOT NULL,
    lng           DOUBLE       NOT NULL,
    country       VARCHAR(100) DEFAULT '',
    city          VARCHAR(100) DEFAULT '',
    name          VARCHAR(255) DEFAULT '',
    response_json TEXT         NOT NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_coord_hash (coord_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
