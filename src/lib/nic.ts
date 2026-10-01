// Sri Lankan National Identity Card numbers: old format 9 digits + V/X (e.g. 901234567V), new format 12 digits.
// Same rule as the update_my_employee_profile RPC (migration 00017).

export function normalizeNic(value: string): string {
  return value.replace(/\s/g, '').toUpperCase();
}

export function isValidNic(value: string): boolean {
  return /^([0-9]{9}[VX]|[0-9]{12})$/.test(normalizeNic(value));
}

export const NIC_HINT = '9 digits followed by V or X (e.g. 901234567V), or 12 digits (e.g. 199012345678)';
