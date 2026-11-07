// Ícono del sprite copiado del prototipo (index.html).
export function Ico({ id, clase = '' }: { id: string; clase?: string }) {
  if (['nequi', 'bancolombia'].includes(id)) return <img class={`ico ico--banco ${clase}`} src={`/bancos/${id}.png`} alt="" aria-hidden="true" />;
  return <svg class={`ico ${clase}`} aria-hidden="true"><use href={`#i-${id}`} /></svg>;
}
