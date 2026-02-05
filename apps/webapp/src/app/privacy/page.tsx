export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <h1 className="text-3xl font-bold">プライバシーポリシー</h1>

      <hr className="border-border" />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">1. 個人情報の定義</h2>
        <p>個人情報とは、以下のような情報により特定の個人を識別することができるものを指します。</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>氏名、年齢、性別、住所、電話番号、職業、メールアドレス</li>
          <li>個人ごとに割り当てられたIDやパスワード、その他識別可能な記号など</li>
          <li>
            単体では個人の特定ができないものの、他の情報と容易に照合することができ、個人を特定できる情報
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">2. 個人情報の収集目的と使用範囲</h2>
        <p>
          個人情報をご提供いただく際には、ユーザーの同意に基づいて行うことを原則とし、無断で収集・利用することはありません。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">3. 第三者への情報提供について</h2>
        <p>
          以下のいずれかに該当する場合を除き、利用者から提供された個人情報を第三者に開示・提供することはありません。
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>利用者本人の同意がある場合</li>
          <li>
            利用者個人が識別されない形（他の情報と照合しても個人を特定できない場合）で提供する場合
          </li>
          <li>法令に基づく開示請求があった場合</li>
          <li>不正アクセスや規約違反など、利用者本人による違反が確認された場合</li>
          <li>第三者に対して不利益を与えると判断された場合</li>
          <li>公共の利益や利用者本人の利益のために必要と判断された場合</li>
          <li>
            寄付金が年間5万円を超える場合、およびそれ以下の金額でも寄付金控除を申請する場合は、政治資金収支報告書に寄付者の情報が記載されます。また、寄附金控除を受ける場合は、総務省のウェブサイトにて寄付年月日・金額・住所・氏名・職業が公開されます。
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">4. 安全管理措置について</h2>
        <p>
          個人情報の適切な管理を行うために、責任者を定めた上で、厳正な管理・監督体制を構築しています。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">5. Cookie（クッキー）について</h2>
        <p>
          Cookieとは、サーバーが利用者の識別を目的として、利用者のブラウザに送信し、端末に保存される情報です。
        </p>
        <p>
          当ウェブサイトでは、Googleによるアクセス解析ツール「Google
          アナリティクス」を使用しており、Google
          アナリティクスはデータ収集のためにCookieを使用しています。データは匿名で収集されており、個人を特定するものではありません。この機能はお使いのブラウザの設定でCookieを無効にすることで拒否することができます。Google
          アナリティクスでデータが収集および処理される仕組みの詳細は
          <a
            href="https://policies.google.com/technologies/partner-sites"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:no-underline"
          >
            「Googleのサービスを使用するサイトやアプリから収集した情報のGoogleによる使用」
          </a>
          のページをご覧ください。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">6. 個人情報の保管期間</h2>
        <p>
          取得した個人情報は、政治資金規正法等の法令に基づき、必要な期間（原則として7年間）保管した後、適切な方法により廃棄・削除いたします。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">7. プライバシーポリシーの改訂と通知について</h2>
        <p>
          このプライバシーポリシーは、必要に応じて内容の見直しを行い、改訂されることがあります。その際、個別の通知は行いませんので、最新の情報については当ウェブサイトをご確認ください。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">8. 個人情報に関するお問い合わせ</h2>
        <p>
          個人情報の確認・修正・削除・利用停止等をご希望される場合は、下記のお問い合わせ窓口までご連絡ください。なお、ご請求内容がご本人によるものであることが確認できた場合に限り、必要な調査を行い、その結果に基づき適切な対応を行います。
        </p>
        <div className="space-y-2">
          <p className="font-semibold">お問い合わせ窓口</p>
          <p>チームみらい 個人情報保護管理責任者</p>
          <p>
            <a
              href="mailto:support@team-mir.ai"
              className="text-primary underline hover:no-underline"
            >
              support@team-mir.ai
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
