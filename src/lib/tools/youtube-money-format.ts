// RPM is a rate, not a payout, so it keeps the decimals a visitor typed (the parser allows at most six).
const rpmFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 });

export const formatRpm = (value: number): string => rpmFormat.format(value);
