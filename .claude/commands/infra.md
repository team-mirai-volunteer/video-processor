---
allowed-tools: Read, Glob, Grep
description: インフラ構成のクイックリファレンス
---

## Terraform構成概要

このプロジェクトのインフラはTerraformで管理されています。

### ディレクトリ構成

```
infrastructure/terraform/
├── envs/
│   ├── stg/          # ステージング環境（現在使用中）
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── backend.tf
│   │   └── .env      # tfvars用の環境変数（gitignore）
│   └── prod/         # 本番環境（未使用）
└── modules/
    ├── cloud-run/    # Cloud Runサービス・ジョブ
    ├── cloud-sql/    # Cloud SQL (PostgreSQL)
    ├── networking/   # VPC, VPC Connector
    └── secrets/      # Secret Manager
```

### モジュール依存関係

```
stg/main.tf
    ├── google_service_account.cloud_run  # 最初に作成
    ├── module.networking                  # VPC, Connector
    ├── module.cloud_sql                   # DB (networking依存)
    ├── module.secrets                     # シークレット管理
    └── module.cloud_run                   # アプリ (全モジュール依存)
```

---

## 環境変数・シークレット追加手順

### 1. Secret Managerで管理する場合（推奨）

**触るファイル（4箇所）:**

| ファイル | 追加内容 |
|---------|---------|
| `modules/secrets/variables.tf` | 変数定義 |
| `modules/secrets/main.tf` | シークレット作成 + IAM |
| `modules/secrets/outputs.tf` | secret_id出力 |
| `modules/cloud-run/variables.tf` | シークレットID変数 |
| `modules/cloud-run/main.tf` | 環境変数（secret_key_ref） |
| `envs/stg/variables.tf` | 変数定義 |
| `envs/stg/main.tf` | モジュール呼び出しに追加 |

**例: `WEBAPP_API_KEY`を追加する場合**

```hcl
# modules/secrets/variables.tf
variable "webapp_api_key" {
  type      = string
  sensitive = true
}

# modules/secrets/main.tf
resource "google_secret_manager_secret" "webapp_api_key" {
  secret_id = "${var.project_name}-webapp-api-key"
  project   = var.project_id
  replication { auto {} }
}
resource "google_secret_manager_secret_version" "webapp_api_key" {
  secret      = google_secret_manager_secret.webapp_api_key.id
  secret_data = var.webapp_api_key
}
resource "google_secret_manager_secret_iam_member" "webapp_api_key_access" {
  secret_id = google_secret_manager_secret.webapp_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.cloud_run_service_account_email}"
  project   = var.project_id
}

# modules/secrets/outputs.tf
output "webapp_api_key_secret_id" {
  value = google_secret_manager_secret.webapp_api_key.secret_id
}

# modules/cloud-run/main.tf (containersブロック内)
env {
  name = "WEBAPP_API_KEY"
  value_source {
    secret_key_ref {
      secret  = var.webapp_api_key_secret_id
      version = "latest"
    }
  }
}
```

### 2. 通常の環境変数の場合

**触るファイル（2箇所）:**

| ファイル | 追加内容 |
|---------|---------|
| `modules/cloud-run/variables.tf` | 変数定義 |
| `modules/cloud-run/main.tf` | envブロック追加 |
| `envs/stg/variables.tf` | 変数定義 |
| `envs/stg/main.tf` | モジュール呼び出しに追加 |

---

## 現在のCloud Run環境変数一覧

| 環境変数名 | ソース | 用途 |
|-----------|--------|------|
| `NODE_ENV` | 固定値 | production |
| `DATABASE_HOST` | 算出 | Cloud SQL接続パス |
| `DATABASE_NAME` | cloud_sql出力 | DB名 |
| `DATABASE_USER` | cloud_sql出力 | DBユーザー |
| `DATABASE_PASSWORD` | Secret Manager | DBパスワード |
| `GOOGLE_CLOUD_PROJECT` | 変数 | GCPプロジェクトID |
| `CORS_ORIGIN` | 変数 | CORS許可オリジン |
| `GOOGLE_DRIVE_OUTPUT_FOLDER_ID` | 変数 | クリップ出力先 |
| `TRANSCRIPT_OUTPUT_FOLDER_ID` | 変数 | 文字起こし出力先 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | 算出 | サービスアカウント |
| `OPENAI_API_KEY` | Secret Manager | OpenAI API |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Secret Manager | GCP認証JSON |
| `WEBAPP_API_KEY` | Secret Manager | BFF認証キー |

---

## tfvars設定（stg）

`envs/stg/.env`に設定する変数:

```bash
TF_VAR_project_id="mirai-video-processor"
TF_VAR_database_password="xxx"
TF_VAR_openai_api_key="sk-xxx"
TF_VAR_google_credentials_json='{"type":"service_account",...}'
TF_VAR_webapp_api_key="xxx"
TF_VAR_container_image="asia-northeast1-docker.pkg.dev/..."
TF_VAR_migration_image="asia-northeast1-docker.pkg.dev/..."
TF_VAR_google_drive_output_folder_id="xxx"
TF_VAR_transcript_output_folder_id="xxx"
```

---

## よく使うコマンド

```bash
# stg環境に移動
cd infrastructure/terraform/envs/stg

# 環境変数読み込み
source .env

# 初期化
terraform init

# 差分確認
terraform plan

# 適用
terraform apply

# フォーマット（全体）
terraform fmt -recursive
```

---

## 注意事項

- **prodは未構築**: 現在stgのみ使用中。prodを触る必要はない
- **terraform fmt**: 変更後は必ず `terraform fmt -recursive` を実行
- **Secret Managerの値変更**: secret_versionが新規作成される。古いバージョンは手動削除
- **Cloud Run再起動**: 環境変数追加後、新リビジョンがデプロイされる
