import recommended from 'stylelint-config-recommended';
import type {PublicApi, Warning, Config, LintResult} from 'stylelint';

const isEqualError = (a: LintResult['parseErrors'][0], b: LintResult['parseErrors'][0]): boolean =>
	a.line === b.line
	&& a.column === b.column
	&& a.endLine === b.endLine
	&& a.endColumn === b.endColumn
	&& a.text === b.text;

/**
 * 使用Stylelint检查CSS代码
 * @param stylelint Stylelint实例
 * @param code CSS代码
 * @param additionalConfig 额外的规则
 * @param fix 是否修正
 */
export function styleLint(
	stylelint: PublicApi,
	code: string,
	additionalConfig?: Config | Config['rules'] | null,
	// @ts-expect-error required parameter
	fix: true,
): Promise<string>;
export function styleLint(
	stylelint: PublicApi,
	code: string,
	additionalConfig?: Config | Config['rules'] | null,
): Promise<Warning[]>;
export async function styleLint(
	stylelint: PublicApi,
	code: string,
	additionalConfig?: Config | Config['rules'] | null,
	fix?: true,
): Promise<string | Warning[]> {
	const isConfig = additionalConfig && ('extends' in additionalConfig || 'rules' in additionalConfig),
		additionalRules: Config['rules'] | null = isConfig ? additionalConfig.rules : additionalConfig,
		rules = isConfig && 'extends' in additionalConfig
			&& additionalConfig.extends !== 'stylelint-config-recommended'
			&& !(
				Array.isArray(additionalConfig.extends)
				&& additionalConfig.extends.includes('stylelint-config-recommended')
			)
			? additionalRules ?? {}
			: {...recommended.rules, ...additionalRules},
		config: Config = {
			rules,
			computeEditInfo: true,
			fix: fix || false,
		};
	if (isConfig) {
		additionalConfig.rules = rules;
	}
	if (fix) {
		return (await stylelint.lint({code, config})).code!;
	}
	const [result] = (await stylelint.lint({code, config})).results;
	return [
		...result!.warnings.filter(({text}) => !text.startsWith('Unknown rule ')),
		...result!.parseErrors
			.reduce<LintResult['parseErrors']>((acc, cur) => { // eslint-disable-line unicorn/no-array-reduce
				if (!acc.some(err => isEqualError(err, cur))) {
					acc.push(cur);
				}
				return acc;
			}, [])
			.map(({line, column, endLine, endColumn, text}): Warning => ({
				line,
				column,
				...endLine && {endLine},
				...endColumn && {endColumn},
				rule: 'parseError',
				severity: 'warning',
				text,
				stylelintType: 'parseError',
			})),
		...result!.invalidOptionWarnings.map(({text}): Warning => {
			const rule = / rule "([^"]+)"/u.exec(text)![1]!;
			return {
				line: 1,
				column: 1,
				rule,
				severity: 'warning',
				text,
				stylelintType: 'invalidOption',
			};
		}),
	];
}
