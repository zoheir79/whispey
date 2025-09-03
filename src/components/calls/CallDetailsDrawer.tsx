"use client"

import type React from "react"
import { useMemo } from "react"
import { X, Bot, Clock, Brain, Volume2, Mic, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useState, useEffect } from "react"
import AudioPlayer from "../AudioPlayer"
import { extractS3Key } from "../../utils/s3"
import { cn } from "@/lib/utils"
import ReactMarkdown, { Options } from "react-markdown"
import remarkGfm from "remark-gfm"

interface TranscriptLog {
  id: string
  session_id: string
  turn_id: string
  user_transcript: string
  agent_response: string
  stt_metrics: any
  llm_metrics: any
  tts_metrics: any
  eou_metrics: any
  lesson_day: number
  created_at: string
  unix_timestamp: number
  phone_number: string
  call_duration: number
  call_success: boolean
  lesson_completed: boolean
}

interface CallDetailsDrawerProps {
  isOpen: boolean
  callData: any
  onClose: () => void
}

const CallDetailsDrawer: React.FC<CallDetailsDrawerProps> = ({ isOpen, callData, onClose }) => {
  const sessionId = callData?.id
  const [transcriptLogs, setTranscriptLogs] = useState<TranscriptLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTranscriptLogs = async () => {
      if (!sessionId) return
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/logs/transcript?session_id=${sessionId}`, {
          method: 'GET',
          headers: { 'authorization': localStorage.getItem('token') || '' }
        })
        if (!response.ok) throw new Error('Failed to fetch transcript logs')
        const data = await response.json()
        setTranscriptLogs(Array.isArray(data) ? data : [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchTranscriptLogs()
  }, [sessionId])

  const basicTranscript = useMemo(() => {
    const transcriptData = (callData?.transcript_json?.length > 0) ? callData.transcript_json : callData?.transcript_with_metrics;
    if (!transcriptData) return null
    try {
      const transcript = Array.isArray(transcriptData) ? transcriptData : JSON.parse(transcriptData)
      if (!Array.isArray(transcript)) return null
      const messages: any[] = []
      transcript.forEach((item: any, index: number) => {
        if (item.user_transcript) messages.push({ id: `user-${item.turn_id || index}`, role: 'user', content: item.user_transcript, timestamp: item.timestamp });
        if (item.agent_response) messages.push({ id: `agent-${item.turn_id || index}`, role: 'assistant', content: item.agent_response, timestamp: item.timestamp });
        if (item.content) messages.push({ id: `basic-${index}`, role: item.role || 'user', content: item.content, timestamp: item.timestamp });
        if (item.text && item.speaker) messages.push({ id: `speaker-${index}`, role: item.speaker === 'agent' ? 'assistant' : 'user', content: item.text, timestamp: item.timestamp, speaker: item.speaker });
      });
      return messages.length > 0 ? messages : [];
    } catch (e) {
      return null
    }
  }, [callData?.transcript_json, callData?.transcript_with_metrics])

  const conversationMetrics = useMemo(() => {
    const metricsSource = callData?.transcript_with_metrics?.length > 0 ? callData.transcript_with_metrics : null
    if (!metricsSource) return null
    const metrics = { stt: [] as number[], llm: [] as number[], tts: [] as number[], eou: [] as number[], totalTurnLatencies: [] as number[] }
    metricsSource.forEach((log: any) => {
      if (log.stt_metrics?.duration) metrics.stt.push(log.stt_metrics.duration)
      if (log.llm_metrics?.ttft) metrics.llm.push(log.llm_metrics.ttft)
      if (log.tts_metrics?.ttfb) metrics.tts.push(log.tts_metrics.ttfb)
      if (log.eou_metrics?.end_of_utterance_delay) metrics.eou.push(log.eou_metrics.end_of_utterance_delay)
      const sttTime = log.stt_metrics?.duration || 0
      const llmTime = log.llm_metrics?.ttft || 0
      const ttsTime = (log.tts_metrics?.ttfb || 0) + (log.tts_metrics?.duration || 0)
      const totalTurnTime = sttTime + llmTime + ttsTime
      if (totalTurnTime > 0) metrics.totalTurnLatencies.push(totalTurnTime)
    })
    const calculateStats = (values: number[]) => {
      if (values.length === 0) return { avg: 0, min: 0, max: 0, count: 0, p95: 0 }
      const sorted = [...values].sort((a, b) => a - b)
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length
      return { avg, min: sorted[0], max: sorted[sorted.length - 1], count: values.length, p95: sorted[Math.floor(sorted.length * 0.95)] || 0 }
    }
    const totalTurnStats = calculateStats(metrics.totalTurnLatencies)
    return { sttStats: calculateStats(metrics.stt), llmStats: calculateStats(metrics.llm), ttsStats: calculateStats(metrics.tts), eouStats: calculateStats(metrics.eou), totalTurnStats, avgTotalLatency: totalTurnStats.avg }
  }, [callData?.transcript_with_metrics])

  const getLatencyColor = (value: number, type: "stt" | "llm" | "tts" | "eou" | "total") => {
    const thresholds = { stt: { good: 1, fair: 2 }, llm: { good: 1, fair: 3 }, tts: { good: 1, fair: 2 }, eou: { good: 0.5, fair: 1.5 }, total: { good: 3, fair: 6 } }
    const threshold = thresholds[type]
    if (value <= threshold.good) return "text-emerald-500 dark:text-emerald-400"
    if (value <= threshold.fair) return "text-amber-500 dark:text-amber-400"
    return "text-red-500 dark:text-red-400"
  }

  const formatTimestamp = (timestamp: number) => new Date(timestamp * 1000).toLocaleString()
  const formatDuration = (seconds: number) => `${seconds.toFixed(2)}s`
  const formatConversationTime = (timestamp: number) => {
    if (!transcriptLogs?.length) return "00:00"
    const firstTimestamp = transcriptLogs[0].unix_timestamp
    const elapsed = timestamp - firstTimestamp
    const minutes = Math.floor(elapsed / 60)
    const seconds = Math.floor(elapsed % 60)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const downloadTranscript = () => {
    const content = transcriptLogs?.length ? transcriptLogs : basicTranscript
    if (!content?.length) return
    const transcriptText = content.map((log: any) => `[${formatConversationTime(log.unix_timestamp || log.timestamp)}] ${log.role || (log.user_transcript ? 'User' : 'Agent')}: ${log.content || log.user_transcript || log.agent_response}`).join("\n\n")
    const blob = new Blob([transcriptText], { type: "text/plain" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transcript-${callData.call_id}.txt`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  const MarkdownComponents: Options['components'] = {
    h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-md font-semibold mb-2 text-gray-900 dark:text-gray-100" {...props} />,
    h3: ({node, ...props}) => <h3 className="text-sm font-medium mb-1 text-gray-900 dark:text-gray-100" {...props} />,
    p: ({node, ...props}) => <p className="mb-2 text-gray-800 dark:text-gray-200" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-800 dark:text-gray-200" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-800 dark:text-gray-200" {...props} />,
    li: ({node, ...props}) => <li className="ml-2" {...props} />,
    strong: ({node, ...props}) => <strong className="font-semibold text-gray-900 dark:text-gray-100" {...props} />,
    table: ({node, ...props}) => <table className="border-collapse border border-gray-300 dark:border-slate-700 w-full mb-4 text-xs" {...props} />,
    thead: ({node, ...props}) => <thead className="bg-gray-100 dark:bg-slate-800" {...props} />,
    tbody: ({node, ...props}) => <tbody className="dark:text-gray-200" {...props} />,
    tr: ({node, ...props}) => <tr className="border-b border-gray-200 dark:border-slate-700" {...props} />,
    th: ({node, ...props}) => <th className="border border-gray-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-left bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100" {...props} />,
    td: ({node, ...props}) => <td className="border border-gray-300 dark:border-slate-700 px-3 py-2 text-xs" {...props} />
  }

  return (
    <TooltipProvider>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[80%] bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col">
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{callData.call_id}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{formatTimestamp(callData.created_at ? new Date(callData.created_at).getTime() / 1000 : Date.now() / 1000)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadTranscript} disabled={!transcriptLogs?.length && !basicTranscript?.length}><Download className="w-4 h-4 mr-2" />Export</Button>
              <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
            </div>
          </div>
          {callData.recording_url && <div className="mb-6"><AudioPlayer s3Key={extractS3Key(callData.recording_url)} url={callData.recording_url} callId={callData.id} /></div>}
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center"><div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{transcriptLogs?.length || basicTranscript?.length || 0}</div><div className="text-sm text-gray-500 dark:text-gray-400">Turns</div></div>
            <div className="text-center"><div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Math.floor(callData.duration_seconds / 60)}:{(callData.duration_seconds % 60).toString().padStart(2, "0")}</div><div className="text-sm text-gray-500 dark:text-gray-400">Duration</div></div>
            <div className="text-center"><div className={cn("text-2xl font-bold", conversationMetrics ? getLatencyColor(conversationMetrics.avgTotalLatency, "total") : "")}>{conversationMetrics ? formatDuration(conversationMetrics.avgTotalLatency) : "N/A"}</div><div className="text-sm text-gray-500 dark:text-gray-400">Avg Latency</div></div>
          </div>
          {conversationMetrics && transcriptLogs?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-3 text-gray-500 dark:text-gray-400 uppercase tracking-wider">PERFORMANCE METRICS</h3>
              <div className="grid grid-cols-4 gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-3 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-help">
                      <div className={cn("text-lg font-semibold", getLatencyColor(conversationMetrics.sttStats.avg, "stt"))}>{formatDuration(conversationMetrics.sttStats.avg)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">STT</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center font-medium">Speech-to-Text</div>
                    <div className="text-xs text-muted-foreground dark:text-slate-400">Time to convert speech to text</div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-3 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-help">
                      <div className={cn("text-lg font-semibold", getLatencyColor(conversationMetrics.llmStats.avg, "llm"))}>{formatDuration(conversationMetrics.llmStats.avg)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">LLM</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center font-medium">Language Model</div>
                    <div className="text-xs text-muted-foreground dark:text-slate-400">Time to generate response</div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-3 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-help">
                      <div className={cn("text-lg font-semibold", getLatencyColor(conversationMetrics.ttsStats.avg, "tts"))}>{formatDuration(conversationMetrics.ttsStats.avg)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">TTS</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center font-medium">Text-to-Speech</div>
                    <div className="text-xs text-muted-foreground dark:text-slate-400">Time to convert text to speech</div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-3 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-help">
                      <div className={cn("text-lg font-semibold", getLatencyColor(conversationMetrics.eouStats.avg, "eou"))}>{formatDuration(conversationMetrics.eouStats.avg)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">EOU</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center font-medium">End of Utterance</div>
                    <div className="text-xs text-muted-foreground dark:text-slate-400">Time to detect speech end</div>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Conversation Transcript</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {loading ? <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div> : 
               error ? <div className="text-center py-12 text-destructive"><p>Error loading transcript: {error}</p></div> : 
               (transcriptLogs?.length || basicTranscript?.length) ? (
                <div className="space-y-6">
                  {(transcriptLogs.length ? transcriptLogs : basicTranscript).map((log: any) => (
                    <div key={log.id} className="space-y-4">
                      <div className="flex gap-4 group">
                        <div className="flex-shrink-0 w-12 text-right"><div className="text-xs text-muted-foreground dark:text-slate-400 font-mono">{formatConversationTime(log.unix_timestamp || log.timestamp)}</div></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1"><Badge variant={log.role === 'user' ? 'outline' : 'secondary'} className="text-xs bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300">{log.role === 'user' ? 'User' : 'Assistant'}</Badge></div>
                          <div className="text-sm leading-relaxed markdown-content text-gray-800 dark:text-gray-200">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>{log.content || log.user_transcript || log.agent_response}</ReactMarkdown>
                          </div>
                          <div className="flex gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {log.stt_metrics && <Tooltip><TooltipTrigger asChild><div className="flex items-center gap-1 text-xs text-muted-foreground dark:text-slate-400 cursor-help"><Mic className="w-3 h-3" />{formatDuration(log.stt_metrics.duration || 0)}</div></TooltipTrigger><TooltipContent>Speech-to-Text processing time</TooltipContent></Tooltip>}
                            {log.eou_metrics && <Tooltip><TooltipTrigger asChild><div className="flex items-center gap-1 text-xs text-muted-foreground dark:text-slate-400 cursor-help"><Clock className="w-3 h-3" />{formatDuration(log.eou_metrics.end_of_utterance_delay || 0)}</div></TooltipTrigger><TooltipContent>End of utterance detection time</TooltipContent></Tooltip>}
                            {log.llm_metrics && <Tooltip><TooltipTrigger asChild><div className={cn("flex items-center gap-1 text-xs cursor-help", getLatencyColor(log.llm_metrics.ttft || 0, "llm"))}><Brain className="w-3 h-3" />{formatDuration(log.llm_metrics.ttft || 0)}</div></TooltipTrigger><TooltipContent>Language model processing time</TooltipContent></Tooltip>}
                            {log.tts_metrics && <Tooltip><TooltipTrigger asChild><div className={cn("flex items-center gap-1 text-xs cursor-help", getLatencyColor(log.tts_metrics.ttfb || 0, "tts"))}><Volume2 className="w-3 h-3" />{formatDuration(log.tts_metrics.ttfb || 0)}</div></TooltipTrigger><TooltipContent>Text-to-speech processing time</TooltipContent></Tooltip>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground dark:text-slate-400">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-2">No conversation transcript available for this call</p>
                  <p className="text-xs">Make sure to include either transcript_json or transcript_with_metrics in your API requests</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default CallDetailsDrawer
