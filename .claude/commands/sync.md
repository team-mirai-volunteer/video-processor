---
allowed-tools: Bash(git:*)
description: developブランチに戻ってリモートと同期する
---

## 現在の状況

- 現在のブランチ: !`git branch --show-current`
- 変更状態: !`git status --short`

## タスク

以下の手順でdevelopブランチに同期してください：

1. **コミット状態の確認**: `git status` で未コミットの変更がないか確認する。変更がある場合はユーザーに報告して終了する（stashするか、コミットするか確認を取る）。

2. **リモートの取得**: `git fetch origin` でリモートの最新状態を取得する。

3. **developへ切り替え**: `git checkout develop` でdevelopブランチに切り替える。

4. **最新化**: `git pull origin develop` でdevelopを最新化する。

5. **完了報告**: 切り替え完了を報告する。
