# Terraform Infrastructure

GCPリソースをTerraformで管理するための設定。

## 構成

```
terraform/
├── envs/
│   ├── stg/          # ステージング環境
│   └── prod/         # 本番環境
├── modules/
│   ├── networking/   # VPC, NAT, VPC Connector
│   ├── cloud-sql/    # Cloud SQL PostgreSQL
│   ├── cloud-run/    # Cloud Run + Artifact Registry
│   └── secrets/      # Secret Manager
├── deploy.sh         # デプロイスクリプト
└── README.md
```

## 前提条件

- Terraform >= 1.0
- gcloud CLI (認証済み)
- envsubst コマンド

## 初回セットアップ

### 1. tfstate用バケットを作成

```bash
gcloud storage buckets create gs://video-processor-tfstate \
  --location=asia-northeast1 \
  --uniform-bucket-level-access
```

### 2. 環境変数ファイルを作成

```bash
# ステージング環境
cp envs/stg/.env.example envs/stg/.env
# .env を編集

# 本番環境
cp envs/prod/.env.example envs/prod/.env
# .env を編集
```

### 3. 必要な環境変数

| 変数名 | 説明 |
|--------|------|
| `GCP_PROJECT_ID` | GCPプロジェクトID |
| `DATABASE_PASSWORD` | Cloud SQLユーザーパスワード |
| `OPENAI_API_KEY` | OpenAI APIキー |
| `GOOGLE_CREDENTIALS_JSON` | サービスアカウントキーJSON |
| `CONTAINER_IMAGE` | Cloud Run用コンテナイメージURL |
| `CORS_ORIGIN` | 許可するCORSオリジン |
| `GOOGLE_DRIVE_OUTPUT_FOLDER_ID` | Google Drive出力フォルダID |

`GOOGLE_CREDENTIALS_JSON` の設定例:
```bash
export GOOGLE_CREDENTIALS_JSON=$(cat path/to/service-account-key.json)
```

## 使い方

```bash
# ステージング環境
./deploy.sh stg plan     # 変更内容を確認
./deploy.sh stg apply    # 適用

# 本番環境
./deploy.sh prod plan
./deploy.sh prod apply

# その他のアクション
./deploy.sh stg init      # 初期化
./deploy.sh stg output    # 出力値を表示
./deploy.sh stg validate  # 構文チェック
./deploy.sh stg fmt       # フォーマット
./deploy.sh stg destroy   # リソース削除（要確認）
```

## コンテナイメージのビルド & プッシュ

Terraform適用後、Artifact RegistryのURLが出力されます。

```bash
# イメージビルド
docker build -t asia-northeast1-docker.pkg.dev/${PROJECT_ID}/video-processor-stg/api:latest \
  -f apps/backend/Dockerfile .

# プッシュ
docker push asia-northeast1-docker.pkg.dev/${PROJECT_ID}/video-processor-stg/api:latest
```

## 環境差分

| 設定 | stg | prod |
|------|-----|------|
| Cloud SQL tier | db-f1-micro | db-custom-2-4096 |
| Cloud SQL HA | ZONAL | REGIONAL |
| バックアップ | 無効 | 有効 |
| 削除保護 | 無効 | 有効 |
| Cloud Run CPU | 1 | 2 |
| Cloud Run Memory | 1Gi | 2Gi |
| 最小インスタンス | 0 | 1 |
| 最大インスタンス | 2 | 10 |
| タイムアウト | 300秒 | 3600秒 |

## トラブルシューティング

### APIが有効化されていないエラー

初回は自動的にAPIが有効化されますが、時間がかかる場合があります。エラーが出たら再度 `apply` を実行してください。

### Cloud SQL接続エラー

VPC Connectorの作成には数分かかります。Cloud Runのデプロイが先に完了してしまう場合は、再度 `apply` を実行してください。
