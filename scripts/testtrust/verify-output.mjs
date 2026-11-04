import { pathToFileURL } from 'node:url';

export function verifyTestTrustOutput({ score, verdict }) {
	if (!/^(0|[1-9][0-9]?|100)$/.test(score ?? '')) {
		throw new Error('TestTrust did not produce a valid score; missing or empty evidence fails closed.');
	}
	if (!['pass', 'neutral', 'fail'].includes(verdict)) {
		throw new Error('TestTrust did not produce a recognized verdict; missing or empty evidence fails closed.');
	}
	if (verdict === 'fail' || Number(score) <= 85) {
		throw new Error(`TestTrust gate failed (score=${score} verdict=${verdict} threshold=85).`);
	}
	return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		verifyTestTrustOutput({ score: process.env.TESTTRUST_SCORE, verdict: process.env.TESTTRUST_VERDICT });
		console.info(`TestTrust output verified (score=${process.env.TESTTRUST_SCORE} verdict=${process.env.TESTTRUST_VERDICT}).`);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
