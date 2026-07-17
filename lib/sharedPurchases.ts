export function getUserPortion(transaction: any): number {
  if (!transaction.isShared || !transaction.sharedSplit) return transaction.value;
  try {
    const split = JSON.parse(transaction.sharedSplit);
    const othersTotal = Object.values(split).reduce((sum: number, v: any) => sum + Number(v), 0);
    const portion = Number(transaction.value) - othersTotal;
    return portion > 0 ? Math.round(portion * 100) / 100 : 0;
  } catch (e) {
    return transaction.value;
  }
}
