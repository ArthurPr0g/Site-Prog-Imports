export function reorderArray<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...list];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}
