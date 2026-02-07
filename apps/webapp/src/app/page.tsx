import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle,
  ArrowRight,
  Github,
  Heart,
  ListOrdered,
  Scissors,
  Share2,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* 選挙活動注意バナー */}
      <div className="overflow-hidden rounded-lg">
        <Image
          src="/election_caution.png"
          alt="投票日当日は選挙活動は禁止です！選挙活動は選挙前日23:59までにお願いします"
          width={800}
          height={600}
          className="w-full"
          priority
        />
      </div>

      {/* 投票日当日の禁止事項 */}
      <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <h2 className="text-lg font-bold text-red-700">投票日当日にやってはいけないこと</h2>
        </div>
        <ul className="space-y-2 text-sm text-red-800">
          <li className="flex items-start gap-2">
            <span className="font-bold text-red-600">×</span>
            <span>
              <strong>SNSでの呼びかけNG</strong>
              ：「●●候補をお願いします」「●●党に投票しよう」などの投稿はできません
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-red-600">×</span>
            <span>
              <strong>いいね・シェア・リポストNG</strong>
              ：過去の投稿であっても、選挙日当日に反応することは禁止されています
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-red-600">×</span>
            <span>
              <strong>プロフィールの更新NG</strong>
              ：選挙運動に関するウェブサイトやSNSプロフィールの更新もできません
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-red-600">×</span>
            <span>
              <strong>特定候補を想起させる投稿NG</strong>
              ：「〇〇候補に投票しました」もNG（「選挙に行こう」のみOK）
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-red-600">×</span>
            <span>
              <strong>ポスター・ビラ配布NG</strong>：貼り直し作業も厳禁です
            </span>
          </li>
        </ul>
      </div>

      {/* ヒーローセクション */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">あなたの切り抜き動画で、チームみらいを届けよう！</h1>
        <p className="text-lg text-muted-foreground">かんたんステップ。スマホだけでできます。</p>
      </div>

      {/* かんたんな使い方 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5" />
            かんたんな使い方（まずはこちら！）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal space-y-2 pl-5">
            <li>下の「切り抜き動画を探す」からクリップ一覧を見る</li>
            <li>気に入ったクリップを選んで、字幕をつける（AIが自動で考えてくれます！）</li>
            <li>完成した動画をダウンロード</li>
            <li>お好きなSNS（TikTok、X、Instagramなど）に投稿！</li>
          </ol>
          <Button asChild>
            <Link href="/clips">
              切り抜き動画を探す
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* 「切り抜き動画」とは？ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            「切り抜き動画」とは？
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="list-disc space-y-1 pl-5">
            <li>チームみらい公式YouTube、候補者の街頭演説や演説会イベントの動画から</li>
            <li>
              「ここ、いいな」「伝わりやすいな」という部分（10〜60秒くらい）を切り取った動画のことです。
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 投稿のお願い */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            SNSへの投稿のお願い
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>
            切り抜いた動画を、ご自身のTikTokやX、Instagramなどに投稿していただければと思います。
          </p>
          <p className="font-semibold">本格的な編集は不要です！</p>
          <p className="text-muted-foreground">
            「動画編集したことない」「SNSは見る専だった」という方も、大歓迎です。
          </p>
        </CardContent>
      </Card>

      {/* 感謝と背景 */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold">切り抜き動画のご協力のお願い</h3>
        <p className="flex items-start gap-2">
          <Heart className="mt-1 h-5 w-5 shrink-0 text-pink-500" />
          <span>いつもあたたかいご支援をありがとうございます。</span>
        </p>
        <p>
          いまチームみらいでは、街頭演説・演説会など、日々たくさんの活動が行われています。
          ただ、それらの活動はまだまだ十分に広がりきっていません。
        </p>
        <p>
          残り数日、これまでチームみらいを知らなかった方にも想いを届けるために、SNSでの「切り抜きショート動画」の力がとても重要になっています。
        </p>
      </div>

      {/* 自分で切り抜く方法 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            自分で切り抜き箇所を選びたい方へ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal space-y-2 pl-5">
            <li>「切り抜きできる動画一覧はこちら」から動画を選ぶ</li>
            <li>動画の詳細ページで「処理を開始」ボタンを押す（文字起こしが自動で行われます）</li>
            <li>文字起こしが完了したら、切り抜きたい箇所を指示して「切り抜き作成」を実行</li>
            <li>できあがったクリップをダウンロードしてSNSに投稿！</li>
          </ol>
          <Button asChild>
            <Link href="/videos">
              切り抜きできる動画一覧はこちら
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* フッターリンク */}
      <div className="border-t pt-6 text-center">
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <a
            href="https://github.com/team-mirai-volunteer/video-processor"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:text-foreground"
          >
            <Github className="h-4 w-4" />
            GitHub Repository
          </a>
          <Link href="/terms" className="hover:text-foreground">
            利用規約
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            プライバシーポリシー
          </Link>
        </div>
      </div>
    </div>
  );
}
