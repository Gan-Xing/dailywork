import { NextResponse } from 'next/server';

import { callDeepseek, DeepseekConfigError, DeepseekRequestError } from '@/lib/ai/deepseekClient';
import type { Locale } from '@/lib/i18n';

interface TranslationRequestBody {
	content?: string;
	section?: string;
	sourceLocale?: Locale;
	targetLocale?: Locale;
}

const SUPPORTED_DIRECTION: Record<Locale, Locale[]> = {
	zh: ['fr'],
	fr: []
};

const TRANSLATION_SYSTEM_PROMPT =
	'You are a bilingual assistant for civil engineering daily reports. Translate the provided text faithfully into concise French. Preserve all measurements and acronyms (PK, RAS, HSE), but do NOT preserve bullet points, numbering or original line breaks. Merge everything into a single compact paragraph on one line. Respond in French only, without quotes, commentary, headings, bullet points or numbering.';

export async function POST(request: Request) {
	let payload: TranslationRequestBody;
	try {
		payload = (await request.json()) as TranslationRequestBody;
	} catch {
		return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
	}

	const { content, section, sourceLocale, targetLocale } = payload;

	if (!content || typeof content !== 'string' || !content.trim()) {
		return NextResponse.json({ message: 'content is required' }, { status: 400 });
	}

	if (!section || typeof section !== 'string') {
		return NextResponse.json({ message: 'section is required' }, { status: 400 });
	}

	if (!sourceLocale || !targetLocale) {
		return NextResponse.json(
			{ message: 'Missing translation locales' },
			{ status: 400 }
		);
	}

	const supportedTargets = SUPPORTED_DIRECTION[sourceLocale] ?? [];
	if (!supportedTargets.includes(targetLocale)) {
		return NextResponse.json(
			{ message: 'Unsupported translation direction' },
			{ status: 400 }
		);
	}

	const trimmedContent = content.trim();
	if (!trimmedContent) {
		return NextResponse.json({ message: 'content is required' }, { status: 400 });
	}

	if (trimmedContent.toUpperCase() === 'RAS') {
		return NextResponse.json({ translation: 'RAS' });
	}

	try {
		const flattenedContent = trimmedContent
			.replace(/\s*\n+\s*/g, ' ') // 把所有换行变成空格
			.replace(/\s+/g, ' ') // 多个空白压成一个空格
			.trim();

		const response = await callDeepseek({
			messages: [
				{ role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
				{
					role: 'user',
					content: [
						`Section: ${section}`,
						'Source language: zh-CN',
						'Target language: fr-FR',
						'Instructions:',
						'1) Convert Chinese punctuation to standard French punctuation.',
						'2) Merge all content into one concise paragraph, without line breaks.',
						'3) Remove bullet points and numbering from the original; do not output any bullet list or numbered list.',
						'4) Do NOT add explanations, prefixes, suffixes, or headings—only the translated text as a single paragraph.',
						'',
						'Source text:',
						flattenedContent
					].join('\n')
				}
			],
			maxTokens: 800,
			temperature: 0.2
		});

		return NextResponse.json({
			translation: response.content,
			usage: response.usage
		});
	} catch (error) {
		if (error instanceof DeepseekConfigError) {
			return NextResponse.json({ message: error.message }, { status: 500 });
		}
		if (error instanceof DeepseekRequestError) {
			return NextResponse.json(
				{
					message: error.message,
					status: error.status,
					payload: error.responseBody
				},
				{ status: 502 }
			);
		}
		return NextResponse.json(
			{ message: (error as Error).message },
			{ status: 500 }
		);
	}
}
