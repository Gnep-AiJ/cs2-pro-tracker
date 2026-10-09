export function faceitSummary(facts: Array<Record<string, unknown>>, chinese: boolean): string {
  return facts.map(fact => {
    const adr = fact.adr as { value?: number | null; count?: number } | undefined;
    const entry = fact.entrySuccess as { value?: number | null; n?: number } | undefined;
    const parts = [chinese ? `${fact.name}：${fact.matches} 场样本，${fact.wins} 胜` : `${fact.name}: ${fact.matches} sampled matches, ${fact.wins} wins`];
    if (adr?.value != null) parts.push(`ADR ${adr.value.toFixed(1)} (n=${adr.count})`);
    if (entry?.value != null) parts.push(`${chinese ? '破点成功率' : 'entry success'} ${entry.value.toFixed(1)}% (n=${entry.n})`);
    return parts.join(chinese ? '，' : ', ') + (chinese ? '。样本有限。' : '. Limited sample.');
  }).join(' ');
}
