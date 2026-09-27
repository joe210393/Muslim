# 案件流程

狀態只經 `packages/contracts` 的 `resolveTransition` 改變。畫面沒有任意狀態下拉。

```text
DRAFT --送件--> SUBMITTED --開始初審--> INITIAL_REVIEW
INITIAL_REVIEW --初審通過--> SECOND_REVIEW --複審通過--> FINAL_REVIEW
FINAL_REVIEW --核定--> APPROVED
INITIAL_REVIEW / SECOND_REVIEW / FINAL_REVIEW --退件--> REJECTED
審查中 --要求補件--> NEED_SUPPLEMENT --重新送件--> 回到要求補件當下的階段
```

補件會把當時階段寫進 `resumeStatus`。重新送件後清空。待核定階段的補件、核定與退件只有管理員可以做。初審與複審可由同一位指派承辦完成，這是精簡版設計，不是雙人複核。

## 並行

每次內容更新與審查都比對 `expectedVersion`。版本不符回 HTTP 409 `VERSION_CONFLICT`。送件、重新送件與審查以 `applicationId + requestId` 唯一；相同 request 重送不會再寫一筆事件。

## 交易

審查、補件與匯入在資料庫交易內提交。通知在案件提交成功後才建立。郵件失敗只把通知工作標成 `FAILED` 或主控台模式的 `MOCKED`，不會把案件狀態滾回，也不會標成 `SENT`。
