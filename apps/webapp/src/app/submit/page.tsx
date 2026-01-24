import { SubmitForm } from '@/components/features/video-form';

export default function SubmitPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">動画登録</h1>
        <p className="text-muted-foreground mt-1">
          Google Driveの動画から自動でショート動画を切り抜きます
        </p>
      </div>

      <SubmitForm />
    </div>
  );
}
