export function isSoloRecord(item: { result: string; position: string }): boolean {
  return item.result === "solo" || item.position === "solo";
}
