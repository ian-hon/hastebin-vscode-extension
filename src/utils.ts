export function toHex(i: number): string {
    return i.toString(16);
}

export function fromHex(h: string): number {
    return parseInt(h.replace('-', ''), 16);
}