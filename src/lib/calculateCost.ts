import { fetchFromTable } from './db-service';
import { UsageData, CostResult } from '../types/logs';

// Default fallback if DB misses data
const FALLBACK = {
  gpt: { in: 0.40, out: 1.60 },
  tts: 50 / 1_000_000,
  sttInrPerSec: 30 / 3600
};

async function getUsdToInr(onDate: string | Date): Promise<number> {
  const date = new Date(onDate).toISOString().slice(0, 10);
  const { data, error } = await fetchFromTable({
    table: 'usd_to_inr_rate',
    select: 'rate',
    filters: [{ column: 'as_of', operator: '=', value: date }]
  });
  
  // Le résultat est un tableau, nous prenons le premier élément
  const rateData = Array.isArray(data) && data.length > 0 ? data[0] : null;
  
  if (error || !rateData || typeof rateData !== 'object' || !('rate' in rateData)) {
    return 87.56; // Fallback rate
  }
  return parseFloat(rateData.rate as string);
}

export async function fetchRate(pricingColumn: string, table: string, filters: Record<string, any>): Promise<number | null> {
  // Convertir les filtres au format attendu par fetchFromTable
  const formattedFilters = Object.entries(filters).map(([column, value]) => ({
    column,
    operator: '=',
    value
  }));
  
  const { data, error } = await fetchFromTable({
    table,
    select: pricingColumn,
    filters: formattedFilters
  });
  
  // Le résultat est un tableau, nous prenons le premier élément
  const resultData = Array.isArray(data) && data.length > 0 ? data[0] : null;
  
  if (error || !resultData || typeof resultData !== 'object' || !(pricingColumn in resultData)) {
    return null;
  }
  return parseFloat(resultData[pricingColumn as keyof typeof resultData] as string);
}

interface TotalCostsParams {
  usageArr?: UsageData[];
  modelName?: string;
  callStartedAt?: string | Date;
}

export async function totalCostsINR({
  usageArr = [],
  modelName = 'gpt-4.1-mini',
  callStartedAt = new Date()
}: TotalCostsParams): Promise<CostResult> {
  const [usdToInr, gptRatesResult, ttsUsdResult, sttUsdSecResult] = await Promise.all([
    getUsdToInr(callStartedAt),
    fetchFromTable({
      table: 'gpt_api_pricing',
      select: 'input_usd_per_million,output_usd_per_million',
      filters: [{ column: 'model_name', operator: '=', value: modelName }]
    }),
    fetchFromTable({
      table: 'audio_api_pricing',
      select: 'cost_usd_per_unit',
      filters: [
        { column: 'unit', operator: '=', value: 'character' },
        { column: 'provider', operator: '=', value: 'ElevenLabs' },
        { column: 'model_or_plan', operator: 'like', value: '%Flash' }
      ]
    }),
    fetchFromTable({
      table: 'audio_api_pricing',
      select: 'cost_inr_per_unit',
      filters: [
        { column: 'unit', operator: '=', value: 'second' },
        { column: 'provider', operator: '=', value: 'Sarvam AI' },
        { column: 'model_or_plan', operator: 'like', value: '%transcription%' }
      ]
    })
  ]);
  
  // Extraire les données des résultats
  const gptRates = {
    data: Array.isArray(gptRatesResult.data) && gptRatesResult.data.length > 0 ? gptRatesResult.data[0] : null,
    error: gptRatesResult.error
  };
  
  const ttsUsd = {
    data: Array.isArray(ttsUsdResult.data) && ttsUsdResult.data.length > 0 ? ttsUsdResult.data[0] : null,
    error: ttsUsdResult.error
  };
  
  const sttUsdSec = {
    data: Array.isArray(sttUsdSecResult.data) && sttUsdSecResult.data.length > 0 ? sttUsdSecResult.data[0] : null,
    error: sttUsdSecResult.error
  };

  // Utiliser des assertions de type pour accéder aux propriétés
  const gptData = gptRates.data as Record<string, any> | null;
  const ttsData = ttsUsd.data as Record<string, any> | null;
  const sttData = sttUsdSec.data as Record<string, any> | null;
  
  const gptInUsd = gptRates.error || !gptData || !('input_usd_per_million' in gptData)
    ? FALLBACK.gpt.in
    : parseFloat(gptData.input_usd_per_million as string);

  const gptOutUsd = gptRates.error || !gptData || !('output_usd_per_million' in gptData)
    ? FALLBACK.gpt.out
    : parseFloat(gptData.output_usd_per_million as string);

  const ttsUsdPerChar = ttsUsd.error || !ttsData || !('cost_usd_per_unit' in ttsData)
    ? FALLBACK.tts
    : parseFloat(ttsData.cost_usd_per_unit as string);

  let sttInrPerSec = sttData && 'cost_inr_per_unit' in sttData ? sttData.cost_inr_per_unit as number : null;
  if (sttUsdSec.error || sttInrPerSec == null) {
    sttInrPerSec = FALLBACK.sttInrPerSec;
  }

  let totalLlmInr = 0;
  let totalTtsInr = 0;
  let totalSttInr = 0;

  for (const u of usageArr) {
    const promptUsd = (u.llm_prompt_tokens || 0) / 1e6 * gptInUsd;
    const outUsd = (u.llm_completion_tokens || 0) / 1e6 * gptOutUsd;
    const llmUsd = promptUsd + outUsd;
    const llmInr = llmUsd * usdToInr;

    const ttsInr = (u.tts_characters || 0) * ttsUsdPerChar * usdToInr;
    const sttInr = (u.stt_audio_duration || 0) * sttInrPerSec;

    totalLlmInr += llmInr;
    totalTtsInr += ttsInr;
    totalSttInr += sttInr;
  }

  return {
    total_llm_cost_inr: Number(totalLlmInr.toFixed(2)),
    total_tts_cost_inr: Number(totalTtsInr.toFixed(2)),
    total_stt_cost_inr: Number(totalSttInr.toFixed(2))
  };
}