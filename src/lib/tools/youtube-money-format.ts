import { RPM_DECIMALS } from './youtube-money';

// RPM is a rate, not a payout, so it keeps the decimals a visitor typed (the parser allows at most RPM_DECIMALS).
const rpmFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: RPM_DECIMALS });
const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const countFormat = new Intl.NumberFormat('en-US');

export const formatRpm = (value: number): string => rpmFormat.format(value);
export const formatCount = (value: number): string => countFormat.format(value);

// Anything between zero and half a cent would print as $0.00, which reads as no earnings at all.
export const formatUsd = (value: number): string => (value > 0 && value < 0.005 ? 'less than $0.01' : usdFormat.format(value));
