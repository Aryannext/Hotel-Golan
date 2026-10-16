// Ícono del sprite copiado del prototipo (index.html).
export function Ico({ id, clase = '' }: { id: string; clase?: string }) {
  return <svg class={`ico ${clase}`} aria-hidden="true"><use href={`#i-${id}`} /></svg>;
}
