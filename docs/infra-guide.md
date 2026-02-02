# インフラストラクチャガイド

本プロジェクトのインフラ構成・Terraform・デプロイに関するガイドです。

## プロジェクト情報

| 項目 | 値 |
|------|-----|
| GCPプロジェクトID | `mirai-video-processor` |
| サービスアカウント（stg） | `video-processor-stg-sa@mirai-video-processor.iam.gserviceaccount.com` |
| Cloud Runサービス名 | `video-processor-stg-api` |
| リージョン | `asia-northeast1` |

### ログ確認

```bash
# Cloud Runログ
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="video-processor-stg-api"' \
  --project mirai-video-processor --limit 50 --format="value(timestamp,textPayload)"
```

GCPコンソール: https://console.cloud.google.com/run/detail/asia-northeast1/video-processor-stg-api/logs?project=mirai-video-processor

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

**重要**: `deploy.sh`を使用すること。直接`terraform`コマンドや`TF_VAR_*`環境変数は使わない。

`deploy.sh`は内部で`envsubst`を使い、`terraform.tfvars.tpl`から`terraform.tfvars`を自動生成する。

**必要な環境変数**（CI/CDまたはローカルでexport）:

| 環境変数名 | 説明 |
|-----------|------|
| `GCP_PROJECT_ID` | GCPプロジェクトID |
| `DATABASE_PASSWORD` | Cloud SQL パスワード |
| `OPENAI_API_KEY` | OpenAI APIキー |
| `GOOGLE_CREDENTIALS_JSON` | サービスアカウントJSON |
| `WEBAPP_API_KEY` | BFF認証キー |
| `CONTAINER_IMAGE` | Cloud Runコンテナイメージ |
| `MIGRATION_IMAGE` | マイグレーションジョブイメージ |
| `CORS_ORIGIN` | CORS許可オリジン |
| `GOOGLE_DRIVE_OUTPUT_FOLDER_ID` | クリップ出力先フォルダID |
| `TRANSCRIPT_OUTPUT_FOLDER_ID` | 文字起こし出力先フォルダID |

---

## Dockerイメージのビルド・プッシュ

```bash
# レジストリ
REGISTRY=asia-northeast1-docker.pkg.dev/mirai-video-processor/video-processor-stg

# バックエンドイメージ（Cloud Run サービス用）
docker build --platform linux/amd64 -f apps/backend/Dockerfile -t ${REGISTRY}/backend:latest .
docker push ${REGISTRY}/backend:latest

# マイグレーションイメージ（Cloud Run ジョブ用）
docker build --platform linux/amd64 -f apps/backend/Dockerfile --target migrator -t ${REGISTRY}/migration:latest .
docker push ${REGISTRY}/migration:latest
```

**注意**: `--platform linux/amd64`は必須（Cloud Runはamd64のみ）

---

## Terraformデプロイ

```bash
# deploy.shを使用（必須）
cd infrastructure/terraform
./deploy.sh stg plan   # 差分確認
./deploy.sh stg apply  # 適用

# フォーマット（全体）
terraform fmt -recursive
```

**禁止**: `terraform plan/apply`を直接実行、`TF_VAR_*`環境変数の使用

---

## 注意事項

- **prodは未構築**: 現在stgのみ使用中。prodを触る必要はない
- **terraform fmt**: 変更後は必ず `terraform fmt -recursive` を実行
- **Secret Managerの値変更**: secret_versionが新規作成される。古いバージョンは手動削除
- **Cloud Run再起動**: 環境変数追加後、新リビジョンがデプロイされる
