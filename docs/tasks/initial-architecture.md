

これは新規リポジトリです。壁打ちしながら私と設計を進めてほしい。

#　実行環境
フロントエンド: vercel + Next
バックエンド: CloudRun + Typescript

# 利用ツール（アプリ）
shadcn
lucide
vercel ai（LLM GATEWAY）


# 利用ツール（環境）
pnpm (monorepo)
biome
jest
playwright(e2e)

# Next Js 設計ルール
ディレクトリ構成
- app (app router)
- forntend


# CloudRun 設計ルール
DDDを採用
- presentation
- application
	- usecases
	- services(オーケストレーションを集約するメリットが有る場合のみ)
- domain
	- models（なるべくドメインロジックをドメインモデルに持たせる）
	- services(複数モデルをまたぐロジック)
	- gateways
- infrastructure
	- repositories
	- clients

# CloudRun テスト設計ルール
/tests
	- unit（基本モックベース）
	- integration (これは、INTEGRATION_TEST=true のときのみ実行。infra/clietsを試す。)
	- e2e（playwright）

# 解決したい課題
- チームみらいという政党の動画政策を助けたい
- Google Driveに、過去のYoutube動画がたくさん上がっている。これは長いし1.5GBくらいある
- これを効率的にショート動画化したい。
- 編集経験のないサポーターにも投稿してもらうために、切り抜き用に、スマホでもロード可能な20-60秒くらいの細切れに分割したい

# 操作イメージ
- 管理画面から、動画のURL(単一。GoogleDriveのリンク。)および、切り抜き箇所（自然言語の長文。複数箇所を指定。）を指定して送信
- サーバー側では、AI（たぶんGeminiが動画理解では良いと思う）を利用して該当部分のタイムスタンプを抽出し、切り抜くべき箇所を理解
- 動画があるディレクトリに、「ショート用」というディレクトリを作成し、その中に、切り抜かれた動画ファイルと、具体的な文字起こしを含んだメタファイル（単一）を配置する
- ゆくゆくは切り抜くべき箇所もAIが判断できるとよいが、今は精度がわからないので後回し
- viewとして、これまでの対応した動画とそこに対して生成されたファイルが見えてほしい
- ログインは不要。誰でも見られるサイトでOK

# 具体的なGoogleDrive動画URLの例
https://drive.google.com/file/d/1_EbA78efkHECZbN_Ixa5TkANMKUE34Tb/view?usp=drive_link
