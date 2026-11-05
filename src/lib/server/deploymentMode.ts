// The one reader of MODERATY_DEPLOYMENT. Billing gates call requireDeploymentMode(),
// which never guesses. The welcome feature keeps isOfficialHosted(), where unset means self-hosted.
import { env } from '$env/dynamic/private';

export type DeploymentMode = 'official-hosted' | 'self-hosted';

/** The declared mode, or undefined when the variable is unset or empty. Any other value throws. */
export function deploymentMode(): DeploymentMode | undefined {
	const value = env.MODERATY_DEPLOYMENT;
	if (!value) return undefined;
	if (value !== 'official-hosted' && value !== 'self-hosted') {
		throw new Error('MODERATY_DEPLOYMENT must be official-hosted or self-hosted');
	}
	return value;
}

/** For billing: unset or invalid throws, so a missing flag can never switch the gate off. */
export function requireDeploymentMode(): DeploymentMode {
	const mode = deploymentMode();
	if (mode === undefined) throw new Error('MODERATY_DEPLOYMENT must be set to official-hosted or self-hosted');
	return mode;
}
