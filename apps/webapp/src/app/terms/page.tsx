export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <h1 className="text-3xl font-bold">みらい動画スタジオ 利用規約</h1>

      <p className="text-muted-foreground">
        本利用規約（以下「本規約」といいます。）は、チームみらい（以下「当団体」といいます。）が提供する「みらい動画スタジオ」（以下「本サービス」といいます。）の利用条件を定めるものです。本サービスを利用するすべての利用者は、本規約に同意したものとみなされます。
      </p>

      <hr className="border-border" />

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">第1条（目的・背景）</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            本サービスは、当団体が管理・保有する動画素材について、切り抜き、短尺化等の編集処理を行うための
            <strong>内部用途向け仕組み</strong>
            として提供されるものです。
          </li>
          <li>
            本サービスは、当団体の政策活動および公的広報活動を支援する目的に限定して利用されるものであり、それ以外の目的での利用を禁止します。
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">第2条（サービス内容および用途制限）</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            本サービスにおいて取り扱うことができる動画素材は、以下に該当するものに限られます。
            <ol className="mt-2 list-decimal space-y-1 pl-6">
              <li>当団体が著作権その他の権利を保有している動画素材</li>
              <li>当団体が合法的に利用する権限を有する動画素材</li>
            </ol>
          </li>
          <li>
            本サービスを通じて生成された短尺動画その他の成果物（以下「生成物」といいます。）は、当団体の政治活動および公的広報活動に限定して利用することができます。
          </li>
          <li>
            前項に定める用途以外の利用、すなわち私的利用、第三者への提供、商用利用その他これらに類する行為は、理由のいかんを問わず禁止します。
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">第3条（禁止行為）</h2>
        <p>利用者は、本サービスの利用にあたり、以下の行為を行ってはなりません。</p>
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            当団体と無関係な動画素材、または前条に定める条件を満たさない動画素材をアップロード、処理または編集する行為
          </li>
          <li>
            著作権、肖像権、プライバシー権その他第三者の権利を侵害する、または侵害するおそれのある行為
          </li>
          <li>本サービスまたは当団体の信用・活動を損なう態様で、動画を公開または利用する行為</li>
          <li>
            過剰な負荷や不正なリソース消費を意図した行為（意図的な大量処理、投機的な処理、高額な計算資源・生成AI利用を誘発する行為等）
          </li>
          <li>
            本サービスの運営を妨害する行為（システムの改ざん、リバースエンジニアリング、脆弱性の不正利用、レート制限・安全制御の回避、その他これらに類する行為）
          </li>
          <li>法令または公序良俗に違反する行為</li>
          <li>当団体が不適切と判断するその他の行為</li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">第4条（個人情報の取扱い）</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>本サービスは、個人情報の収集、利用または保存を目的として設計されていません。</li>
          <li>
            利用者は、本サービスの利用にあたり、個人情報を含むデータを入力、アップロードまたは処理してはなりません。
          </li>
          <li>
            利用者が前項に違反したことにより生じた損害またはトラブルについて、当団体は一切の責任を負いません。
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">第5条（知的財産権）</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            本サービスに関連する動画素材、生成物および本サービスに関する一切の知的財産権は、特段の定めがない限り、当団体に帰属します。
          </li>
          <li>
            利用者は、生成物について著作権その他の権利を主張せず、当団体の指示または方針に従って利用するものとします。
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">第6条（違反時の措置）</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            当団体は、利用者が本規約に違反したと判断した場合、事前の通知なく、以下の措置を講じることができます。
            <ol className="mt-2 list-decimal space-y-1 pl-6">
              <li>本サービスの全部または一部の利用停止</li>
              <li>アカウントの停止または削除</li>
              <li>本サービス上のデータまたは生成物の削除</li>
            </ol>
          </li>
          <li>
            違反行為が悪質である場合、当団体は、法的措置その他必要な対応を講じることがあります。
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">第7条（免責および責任制限）</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            当団体は、本サービスの内容について、その完全性、正確性、有用性または特定目的への適合性を保証するものではありません。
          </li>
          <li>
            当団体は、予告なく本サービスの内容を変更し、または提供を停止・中断することがあります。
          </li>
          <li>
            本サービスの利用に関連して生じた利用者自身の行為または第三者との間のトラブルについては、利用者の責任において解決するものとし、当団体は一切の責任を負いません。
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">第8条（規約の変更）</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>当団体は、必要に応じて本規約を変更することができます。</li>
          <li>
            本規約の変更後に利用者が本サービスを利用した場合、当該変更に同意したものとみなされます。
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">第9条（準拠法および管轄）</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>本規約は、日本法を準拠法とします。</li>
          <li>
            本サービスまたは本規約に関して当団体と利用者との間に生じた紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          </li>
        </ol>
      </section>
    </div>
  );
}
