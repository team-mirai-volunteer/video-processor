export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <h1 className="text-3xl font-bold">プライバシーポリシー（Privacy Policy）</h1>

      <p className="text-muted-foreground">
        みらい動画スタジオ（以下「本サービス」といいます。）は、チームみらい（以下「当団体」といいます。）が提供する、動画素材の切り抜き・短尺化を行うための内部向けサービスです。
        本サービスにおける利用者のプライバシーを尊重し、以下のとおりプライバシーポリシーを定めます。
      </p>

      <hr className="border-border" />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">1. 基本方針</h2>
        <p>
          本サービスは、個人情報を取得・利用しないことを原則として設計・運用されています。
          利用者が自ら意図的に提供しない限り、個人情報を取得・利用することはありません。
        </p>
        <p>
          また、本ポリシーでは、利用者に誤解を与えないよう、個人情報を扱わないサービスであることを明確に示すことを基本方針とします。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">2. 個人情報の定義</h2>
        <p>
          本ポリシーにおいて「個人情報」とは、氏名、住所、メールアドレスその他、特定の個人を識別できる情報を指します。
          ただし、本サービスでは、これらの個人情報を取得・利用することはありません。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">3. 個人情報の取得について</h2>
        <p>
          本サービスでは、利用者が意図的に提供した情報を除き、個人情報を収集・利用することはありません。
        </p>
        <p>
          万一、運営上の必要性から個人情報の取り扱いが発生する場合には、事前に利用者の明示的な同意を得た上で、必要最小限の範囲に限定して取り扱うものとします。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">4. 利用目的</h2>
        <p>本サービスは個人情報を取り扱わないため、個人情報の利用目的は存在しません。</p>
        <p>
          ただし、問い合わせ対応等により例外的に個人情報の取得が必要となる場合には、取得時にその利用目的を明示し、当該目的の範囲内でのみ利用します。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">5. 第三者提供について</h2>
        <p>本サービスでは個人情報を取得しないため、第三者への提供は行いません。</p>
        <p>
          なお、法令に基づく開示請求がある場合や、利用者本人の同意がある場合など、法令上認められる例外的な状況が生じた場合には、この限りではありません。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">6. Cookie・ログ等の取り扱い</h2>
        <p>
          本サービスでは、サービスの改善や安定的な運用を目的として、Cookie
          やアクセスログ等の技術情報を取得する場合があります。
        </p>
        <p>
          これらの情報は、個人を特定しない匿名化された情報として取り扱い、利用者の識別を目的とするものではありません。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">7. 安全管理措置</h2>
        <p>
          本サービスでは個人情報を取り扱いませんが、取得する匿名データやアクセスログ等についても、不正アクセスや漏えい等を防止するため、組織的・技術的な安全管理措置を講じます。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">8. データの保管および廃棄</h2>
        <p>
          本サービスでは個人情報を取り扱わないため、個人情報に関する特別な保管・廃棄ルールは設けていません。
        </p>
        <p>
          ただし、匿名データやログ等については、利用目的に照らして必要最小限の期間のみ保持し、不要となった場合には適切に削除します。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">9. プライバシーポリシーの改訂</h2>
        <p>
          本ポリシーの内容は、法令の変更やサービス内容の見直し等に応じて、必要に応じて改訂されることがあります。
          改訂後のプライバシーポリシーは、本サービス上に掲載することで周知します。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">10. お問い合わせ窓口</h2>
        <p>本ポリシーに関するお問い合わせは、以下の窓口までご連絡ください。</p>
        <p>運営：チームみらい</p>
        <p>お問い合わせ先：本サービス上に掲載する連絡先</p>
      </section>
    </div>
  );
}
