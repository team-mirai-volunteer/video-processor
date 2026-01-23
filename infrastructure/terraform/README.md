# Video Processor - Terraform Infrastructure

このディレクトリには、Video ProcessorアプリケーションのGCPインフラストラクチャをプロビジョニングするためのTerraform設定が含まれています。

## 前提条件

### 必要なツール

- [Terraform](https://www.terraform.io/downloads) >= 1.5.0
- [Google Cloud SDK (gcloud CLI)](https://cloud.google.com/sdk/docs/install)
- GCPプロジェクトへの管理者アクセス権限

### GCP APIの有効化

以下のAPIを有効にする必要があります：

```bash
# プロジェクトIDを設定
export PROJECT_ID="your-project-id"

# 必要なAPIを有効化
gcloud services enable compute.googleapis.com --project=$PROJECT_ID
gcloud services enable sqladmin.googleapis.com --project=$PROJECT_ID
gcloud services enable run.googleapis.com --project=$PROJECT_ID
gcloud services enable vpcaccess.googleapis.com --project=$PROJECT_ID
gcloud services enable servicenetworking.googleapis.com --project=$PROJECT_ID
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudresourcemanager.googleapis.com --project=$PROJECT_ID
gcloud services enable iam.googleapis.com --project=$PROJECT_ID
gcloud services enable artifactregistry.googleapis.com --project=$PROJECT_ID
```

## ディレクトリ構成

```
terraform/
├── environments/
│   └── prod/                    # 本番環境
│       ├── main.tf              # モジュール呼び出し
│       ├── variables.tf         # 変数定義
│       ├── terraform.tfvars.example  # サンプル値
│       ├── outputs.tf           # 出力値
│       ├── backend.tf           # GCS backend設定
│       └── versions.tf          # プロバイダーバージョン
├── modules/
│   ├── cloud-run/               # Cloud Runサービス
│   ├── cloud-sql/               # PostgreSQLインスタンス
│   ├── networking/              # VPC, Cloud NAT
│   └── iam/                     # サービスアカウント
└── README.md                    # このファイル
```

## 初期セットアップ

### 1. 認証設定

```bash
# GCPにログイン
gcloud auth login

# アプリケーションデフォルト認証を設定
gcloud auth application-default login

# プロジェクトを設定
gcloud config set project $PROJECT_ID
```

### 2. Terraform State用のGCSバケット作成（オプション、推奨）

```bash
# バケットを作成
gsutil mb -l asia-northeast1 gs://${PROJECT_ID}-terraform-state

# バージョニングを有効化
gsutil versioning set on gs://${PROJECT_ID}-terraform-state
```

作成後、`environments/prod/backend.tf`のコメントを解除して設定を有効にしてください。

### 3. Secret Managerにシークレットを作成

```bash
# データベース接続URL
echo -n "postgresql://app:YOUR_PASSWORD@/video_processor?host=/cloudsql/${PROJECT_ID}:asia-northeast1:video-processor-db-prod" | \
  gcloud secrets create video-processor-database-url --data-file=- --project=$PROJECT_ID

# Gemini API Key
echo -n "YOUR_GEMINI_API_KEY" | \
  gcloud secrets create video-processor-gemini-api-key --data-file=- --project=$PROJECT_ID
```

### 4. 変数ファイルの準備

```bash
cd environments/prod

# サンプルファイルをコピー
cp terraform.tfvars.example terraform.tfvars

# エディタで値を編集
vim terraform.tfvars
```

## Terraform実行手順

### 1. 初期化

```bash
cd infrastructure/terraform/environments/prod

# Terraformを初期化
terraform init
```

### 2. プランの確認

```bash
# 変更内容を確認
terraform plan
```

### 3. 適用

```bash
# インフラストラクチャをデプロイ
terraform apply
```

確認プロンプトで `yes` と入力してください。

### 4. 出力の確認

```bash
# 出力値を表示
terraform output
```

## モジュール詳細

### networking

VPCネットワーク、サブネット、Cloud NAT、Serverless VPC Access Connectorを作成します。

- **VPC**: プライベートネットワーク
- **Cloud NAT**: 外部API（Google Drive、Gemini）へのアクセス用
- **VPC Connector**: Cloud RunからCloud SQLへの接続用

### iam

Cloud Run用のサービスアカウントとIAMバインディングを作成します。

付与される権限：
- `roles/cloudsql.client` - Cloud SQL接続
- `roles/secretmanager.secretAccessor` - Secret Manager読み取り
- `roles/logging.logWriter` - ログ書き込み
- `roles/cloudtrace.agent` - トレースデータ送信

### cloud-sql

PostgreSQL 15インスタンスを作成します。

特徴：
- プライベートIPのみ（セキュアな接続）
- 自動バックアップ有効
- ポイントインタイムリカバリ対応

### cloud-run

APIサービスをデプロイします。

特徴：
- VPC経由でCloud SQLに接続
- 最大1時間のリクエストタイムアウト（動画処理用）
- 自動スケーリング（0〜10インスタンス）
- FFmpeg処理用に2 CPU / 2Gi メモリ

## 環境変数

Cloud Runに設定される環境変数：

| 変数名 | 説明 |
|--------|------|
| `NODE_ENV` | 実行環境（production） |
| `GOOGLE_CLOUD_PROJECT` | GCPプロジェクトID |
| `CORS_ORIGIN` | フロントエンドURL |
| `PORT` | サービスポート（8080） |
| `DB_HOST` | Cloud SQL接続パス |
| `DB_NAME` | データベース名 |
| `DB_USER` | データベースユーザー |
| `DATABASE_URL` | （Secret Manager経由） |
| `GOOGLE_GENERATIVE_AI_API_KEY` | （Secret Manager経由） |

## トラブルシューティング

### terraform initが失敗する

```bash
# キャッシュをクリアして再試行
rm -rf .terraform .terraform.lock.hcl
terraform init
```

### Cloud SQL接続エラー

1. Private Service Connectionが正しく設定されているか確認
2. VPC Connectorが正しいVPCに接続されているか確認
3. Cloud Runのサービスアカウントに`cloudsql.client`ロールがあるか確認

### Cloud Runがデプロイできない

1. コンテナイメージがArtifact Registryにプッシュされているか確認
2. サービスアカウントにArtifact Registryの読み取り権限があるか確認

## 破棄手順

インフラストラクチャを削除する場合：

```bash
# 削除保護を無効化（Cloud SQL）
terraform apply -var="cloud_sql_deletion_protection=false"

# リソースを削除
terraform destroy
```

⚠️ **注意**: 本番環境では慎重に実行してください。データベースのバックアップを確認してから削除してください。

## 参考リンク

- [Terraform Google Provider Documentation](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [VPC Access Connector Documentation](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access)
