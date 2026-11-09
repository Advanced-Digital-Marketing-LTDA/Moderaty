// Pure earnings math for the YouTube money calculator. Every value a visitor
// types passes through parseRequiredNumber; bad input throws CalcInputError and
// runCalculator / runNiche turn it into a message for the page. Nothing here
// fills in a default RPM or clamps an out-of-range value.

export const MAX_MONTHLY_VIEWS = 1_000_000_000;
export const MAX_RPM_USD = 1000;
export const MAX_MONTHLY_USD = 1_000_000_000;
export const DAYS_PER_MONTH = 30;
// YouTube Help (support.google.com/youtube/answer/72902): creators keep 55% of net ad revenue on long-form.
export const LONG_FORM_REVENUE_SHARE = 0.55;

export class CalcInputError extends Error {}

type NumberOptions = { max: number; whole?: boolean };

export function parseRequiredNumber(raw: string, label: string, options: NumberOptions): number {
	const text = raw.trim();
	if (text === '') throw new CalcInputError(`${label} is empty. Enter a number.`);
	if (!/^\d+(\.\d+)?$/.test(text)) throw new CalcInputError(`${label} must be a plain number such as 3.50, with no letters, signs, exponents or commas.`);
	const value = Number(text);
	if (value <= 0) throw new CalcInputError(`${label} must be greater than zero.`);
	if (value > options.max) throw new CalcInputError(`${label} must be ${options.max} or less.`);
	if (options.whole && !Number.isInteger(value)) throw new CalcInputError(`${label} must be a whole number.`);
	return value;
}

export type StreamInput = { label: 'Long-form' | 'Shorts'; views: number; rpm: number };

export type Outputs = {
	monthlyUsd: number;
	dailyUsd: number;
	yearlyUsd: number;
	perMillionUsd: number;
	totalViews: number;
	blendedRpm: number;
	halfRpmMonthlyUsd: number;
	doubleRpmMonthlyUsd: number;
	viewsNeeded: number | null;
};

// Whole views needed. The relative tolerance absorbs float noise on an exact answer without adding a view,
// and a positive goal always needs at least one view.
const wholeViews = (value: number) => Math.max(1, Math.ceil(value - value * 1e-14));

const earnedPerStream = (streams: StreamInput[], factor: number) =>
	streams.reduce((sum, stream) => sum + (stream.views / 1000) * stream.rpm * factor, 0);

export function calculate(streams: StreamInput[], goalUsd: number | null): Outputs {
	if (streams.length === 0) throw new CalcInputError('Enter views and RPM for at least one content type.');
	const monthlyUsd = earnedPerStream(streams, 1);
	const totalViews = streams.reduce((sum, stream) => sum + stream.views, 0);
	const blendedRpm = (monthlyUsd / totalViews) * 1000;
	const viewsNeeded = goalUsd === null ? null : wholeViews((goalUsd / blendedRpm) * 1000);
	// Written so that NaN and Infinity also fail: an answer this large is not a number the page may show.
	if (viewsNeeded !== null && !(viewsNeeded <= MAX_MONTHLY_VIEWS)) {
		throw new CalcInputError('The goal needs more views a month than this calculator accepts. Check the goal and the RPM.');
	}
	return {
		monthlyUsd,
		dailyUsd: monthlyUsd / DAYS_PER_MONTH,
		yearlyUsd: monthlyUsd * 12,
		perMillionUsd: blendedRpm * 1000,
		totalViews,
		blendedRpm,
		halfRpmMonthlyUsd: earnedPerStream(streams, 0.5),
		doubleRpmMonthlyUsd: earnedPerStream(streams, 2),
		viewsNeeded
	};
}

// CPM x monetized share x 55%: the RPM a long-form niche implies. Shorts never use this.
export function cpmToLongFormRpm(cpmUsd: number, monetizedPercent: number): number {
	return cpmUsd * (monetizedPercent / 100) * LONG_FORM_REVENUE_SHARE;
}

export type CalcRun = { ok: true; streams: StreamInput[]; outputs: Outputs; goalUsd: number | null } | { ok: false; error: string };
export type NicheRun = { ok: true; rpmLow: number; rpmHigh: number } | { ok: false; error: string };

export type CalculatorForm = {
	contentType: 'long-form' | 'shorts' | 'both';
	longFormViews: string;
	longFormRpm: string;
	shortsViews: string;
	shortsRpm: string;
	goalUsd: string;
};

function readStream(label: StreamInput['label'], views: string, rpm: string): StreamInput {
	return {
		label,
		views: parseRequiredNumber(views, `${label} monthly views`, { max: MAX_MONTHLY_VIEWS, whole: true }),
		rpm: parseRequiredNumber(rpm, `${label} RPM`, { max: MAX_RPM_USD })
	};
}

// Only the selected content types are read, so a stale hidden field never blocks a result.
export function runCalculator(form: CalculatorForm): CalcRun {
	try {
		const streams: StreamInput[] = [];
		if (form.contentType !== 'shorts') streams.push(readStream('Long-form', form.longFormViews, form.longFormRpm));
		if (form.contentType !== 'long-form') streams.push(readStream('Shorts', form.shortsViews, form.shortsRpm));
		const goal = form.goalUsd.trim() === '' ? null : parseRequiredNumber(form.goalUsd, 'Monthly income goal', { max: MAX_MONTHLY_USD });
		return { ok: true, streams, outputs: calculate(streams, goal), goalUsd: goal };
	} catch (error) {
		if (error instanceof CalcInputError) return { ok: false, error: error.message };
		throw error;
	}
}

export function runNiche(monetizedRaw: string, cpmLow: number, cpmHigh: number): NicheRun {
	try {
		const monetized = parseRequiredNumber(monetizedRaw, '% of views that are monetized', { max: 100 });
		return { ok: true, rpmLow: cpmToLongFormRpm(cpmLow, monetized), rpmHigh: cpmToLongFormRpm(cpmHigh, monetized) };
	} catch (error) {
		if (error instanceof CalcInputError) return { ok: false, error: error.message };
		throw error;
	}
}
