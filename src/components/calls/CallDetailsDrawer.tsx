"use client"

import type React from "react"
import { useMemo } from "react"
import { X, Bot, Clock, Brain, Volume2, Mic, Activity, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useState, useEffect } from "react"
// Removed unused db-service import - already using API endpoints
import AudioPlayer from "../AudioPlayer"
import { extractS3Key } from "../../utils/s3"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
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
          headers: {
            'authorization': localStorage.getItem('token') || ''
          }
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

  
  // Parse transcript data from transcript_with_metrics or transcript_json
  const basicTranscript = useMemo(() => {
    console.log('🔍 DEBUG - callData.transcript_json:', callData?.transcript_json);
    console.log('🔍 DEBUG - callData.transcript_with_metrics:', callData?.transcript_with_metrics);
    console.log('🔍 DEBUG - transcriptLogs length:', transcriptLogs?.length);
    
    // Use transcript_with_metrics if transcript_json is empty
    const transcriptData = (callData?.transcript_json && Array.isArray(callData.transcript_json) && callData.transcript_json.length > 0) 
      ? callData.transcript_json 
      : callData?.transcript_with_metrics;
    
    if (!transcriptData) return null
    
    try {
      const transcript = Array.isArray(transcriptData) 
        ? transcriptData 
        : (typeof transcriptData === 'string' 
           ? JSON.parse(transcriptData)
           : transcriptData)
      
      console.log('🔍 DEBUG - parsed transcript:', transcript);
      
      // Ensure we have an array before mapping
      if (!Array.isArray(transcript)) {
        console.warn('transcript_json is not an array:', transcript)
        return null
      }
      
      // Handle transcript_with_metrics format (each item has user_transcript AND agent_response)
      const messages: any[] = [];
      
      transcript.forEach((item: any, index: number) => {
        if (item.user_transcript) {
          messages.push({
            id: `user-${item.turn_id || index}`,
            role: 'user',
            content: item.user_transcript,
            timestamp: item.timestamp,
            turn_id: item.turn_id || (index + 1)
          });
        }
        
        if (item.agent_response) {
          messages.push({
            id: `agent-${item.turn_id || index}`,
            role: 'assistant',
            content: item.agent_response,
            timestamp: item.timestamp,
            turn_id: item.turn_id || (index + 1)
          });
        }
        
        // Fallback for simple transcript_json format
        if (item.content && !item.user_transcript && !item.agent_response) {
          messages.push({
            id: `basic-${index}`,
            role: item.role || 'user',
            content: item.content,
            timestamp: item.timestamp,
            turn_id: item.turn_id || (index + 1)
          });
        }
      });
      
      console.log('🔍 DEBUG - processed messages:', messages);
      return messages;
    } catch (e) {
      console.error('Error parsing transcript_json:', e)
      return null
    }
  }, [callData?.transcript_json, callData?.transcript_with_metrics, transcriptLogs])
  
  // Calculate conversation metrics
  const conversationMetrics = useMemo(() => {
    // Use transcript_with_metrics for detailed metrics, fallback to basic calculation
    const metricsSource = transcriptLogs?.length > 0 ? transcriptLogs : null
    const hasBasicTranscript = basicTranscript && basicTranscript.length > 0
    
    if (!metricsSource && !hasBasicTranscript) return null
  
    const metrics = {
      stt: [] as number[],
      llm: [] as number[],
      tts: [] as number[],
      eou: [] as number[],
      agentResponseLatencies: [] as number[],
      totalTurnLatencies: [] as number[], // NEW: Complete turn latency
      endToEndLatencies: [] as number[], // NEW: User speak to agent speak
      totalTurns: metricsSource ? metricsSource.length : (hasBasicTranscript ? basicTranscript.length : 0),
    }
  
    if (metricsSource) {
      // Use detailed metrics from transcript_with_metrics
      metricsSource.forEach((log: TranscriptLog) => {
      // Individual component latencies
      if (log.stt_metrics?.duration) metrics.stt.push(log.stt_metrics.duration)
      if (log.llm_metrics?.ttft) metrics.llm.push(log.llm_metrics.ttft)
      if (log.tts_metrics?.ttfb) metrics.tts.push(log.tts_metrics.ttfb)
      if (log.eou_metrics?.end_of_utterance_delay) metrics.eou.push(log.eou_metrics.end_of_utterance_delay)
  
      // CORRECTED: Agent response time should include TTS duration, not just TTFB
      if (log.user_transcript && log.agent_response && log.llm_metrics?.ttft && log.tts_metrics) {
        const llmTime = log.llm_metrics.ttft || 0
        const ttsTime = (log.tts_metrics.ttfb || 0) + (log.tts_metrics.duration || 0) // Include full TTS time
        const agentResponseTime = llmTime + ttsTime
        metrics.agentResponseLatencies.push(agentResponseTime)
      }
  
      // NEW: Calculate total turn latency (STT + LLM + TTS)
      if (log.stt_metrics && log.tts_metrics) {
        const sttTime = log.stt_metrics?.duration || 0
        const llmTime = log.llm_metrics?.ttft || 0
        const ttsTime = (log.tts_metrics?.ttfb || 0) + (log.tts_metrics?.duration || 0)
        const totalTurnTime = llmTime + ttsTime + sttTime

        if(totalTurnTime > 0)
        {
          metrics.totalTurnLatencies.push(totalTurnTime)
        }
      }
  
      // NEW: Calculate end-to-end latency (includes EOU detection)
      if (log.eou_metrics?.end_of_utterance_delay && log.stt_metrics?.duration && 
          log.llm_metrics?.ttft && log.tts_metrics) {
        const eouTime = log.eou_metrics.end_of_utterance_delay || 0
        const sttTime = log.stt_metrics.duration || 0
        const llmTime = log.llm_metrics.ttft || 0
        const ttsTime = (log.tts_metrics.ttfb || 0) + (log.tts_metrics.duration || 0)
        const endToEndTime = eouTime + sttTime + llmTime + ttsTime
        metrics.endToEndLatencies.push(endToEndTime)
      }
    })
    } else if (hasBasicTranscript) {
      // Fallback: Estimate latency from basic transcript timing
      // Calculate average time between messages as a rough latency estimate
      for (let i = 0; i < basicTranscript.length - 1; i++) {
        const current = basicTranscript[i]
        const next = basicTranscript[i + 1]
        
        if (current.speaker === 'customer' && next.speaker === 'agent' && 
            current.timestamp && next.timestamp) {
          const responseTime = (next.timestamp - current.timestamp) * 1000 // Convert to ms
          if (responseTime > 0 && responseTime < 30000) { // Reasonable bounds (0-30s)
            metrics.agentResponseLatencies.push(responseTime)
            metrics.totalTurnLatencies.push(responseTime)
          }
        }
      }
    }
  
    const calculateStats = (values: number[]) => {
      if (values.length === 0) return { avg: 0, min: 0, max: 0, count: 0, p95: 0 }
      const sorted = [...values].sort((a, b) => a - b)
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length
      const min = Math.min(...values)
      const max = Math.max(...values)
      const p95Index = Math.floor(sorted.length * 0.95)
      const p95 = sorted[p95Index] || 0
      return { avg, min, max, count: values.length, p95 }
    }
  
    return {
      ...metrics,
      sttStats: calculateStats(metrics.stt),
      llmStats: calculateStats(metrics.llm),
      ttsStats: calculateStats(metrics.tts),
      eouStats: calculateStats(metrics.eou),
      agentResponseStats: calculateStats(metrics.agentResponseLatencies),
      totalTurnStats: calculateStats(metrics.totalTurnLatencies), // NEW
      endToEndStats: calculateStats(metrics.endToEndLatencies), // NEW
      
      // CORRECTED: Average total latency should be from actual turn calculations
      avgTotalLatency: calculateStats(metrics.totalTurnLatencies).avg,
      avgAgentResponseTime: calculateStats(metrics.agentResponseLatencies).avg,
      avgEndToEndLatency: endToEndStats.avg,
      avgTotalLatency: totalTurnStats.avg, // This combines all processing steps
    }
  }, [transcriptLogs, basicTranscript])

  console.log(conversationMetrics)
  
  // CORRECTED: Update the color thresholds and usage
{{ ... }}
  const getLatencyColor = (value: number, type: "stt" | "llm" | "tts" | "eou" | "total" | "e2e") => {
    const thresholds = {
      stt: { good: 1, fair: 2 },
      llm: { good: 1, fair: 3 },
      tts: { good: 1, fair: 2 },
      eou: { good: 0.5, fair: 1.5 }, // CORRECTED: EOU should be much faster
      total: { good: 3, fair: 6 },
      e2e: { good: 4, fair: 8 }, // NEW: End-to-end thresholds
    }
    const threshold = thresholds[type]
    if (value <= threshold.good) return "text-emerald-500"
    if (value <= threshold.fair) return "text-amber-500"
    return "text-red-500"
  }

  
  

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString()
  }

  const formatDuration = (seconds: number) => {
    return `${seconds.toFixed(2)}s`
  }

  const formatConversationTime = (timestamp: number) => {
    if (!transcriptLogs?.length) return "00:00"
    const firstTimestamp = transcriptLogs[0].unix_timestamp
    const elapsed = timestamp - firstTimestamp
    const minutes = Math.floor(elapsed / 60)
    const seconds = Math.floor(elapsed % 60)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const downloadTranscript = () => {
    if (!transcriptLogs?.length) return

    const transcriptText = transcriptLogs
      .map((log: TranscriptLog) => {
        const timestamp = formatConversationTime(log.unix_timestamp)
        let text = `[${timestamp}]\n`
        if (log.user_transcript) {
          text += `User: ${log.user_transcript}\n`
        }
        if (log.agent_response) {
          text += `Agent: ${log.agent_response}\n`
        }
        return text + "\n"
      })
      .join("")

    const blob = new Blob([transcriptText], { type: "text/plain" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transcript-${callData.call_id}.txt`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <TooltipProvider>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-[80%] bg-background border-l shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">{callData.call_id}</h2>
              <p className="text-sm text-muted-foreground">
                {formatTimestamp(
                  callData.created_at ? new Date(callData.created_at).getTime() / 1000 : Date.now() / 1000,
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadTranscript} disabled={!transcriptLogs?.length}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Audio Player */}
          {callData.recording_url && (
            <div className="mb-6">
              <AudioPlayer s3Key={extractS3Key(callData.recording_url)} url={callData.recording_url} callId={callData.id} />
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {(() => {
                  // Correct: Use transcriptLogs if available, otherwise basicTranscript (avoid double counting)
                  const totalTurns = transcriptLogs?.length || basicTranscript?.length || 0;
                  console.log('🔍 DEBUG - Turns calculation:', {
                    transcriptLogs: transcriptLogs?.length || 0,
                    basicTranscript: basicTranscript?.length || 0,
                    totalTurns,
                    source: transcriptLogs?.length ? 'transcriptLogs' : 'basicTranscript'
                  });
                  return totalTurns;
                })()}
              </div>
              <div className="text-sm text-muted-foreground">Turns</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {Math.floor(callData.duration_seconds / 60)}:
                {(callData.duration_seconds % 60).toString().padStart(2, "0")}
              </div>
              <div className="text-sm text-muted-foreground">Duration</div>
            </div>
            <div className="text-center">
              <div
                className={cn(
                  "text-2xl font-bold",
                  conversationMetrics ? getLatencyColor(conversationMetrics.avgTotalLatency, "total") : "",
                )}
              >
                {conversationMetrics ? formatDuration(conversationMetrics.avgTotalLatency) : "N/A"}
              </div>
              <div className="text-sm text-muted-foreground">Avg Latency</div>
            </div>
          </div>

          {/* Performance Metrics - only show for metrics-based transcripts */}
          {conversationMetrics && transcriptLogs?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">PERFORMANCE METRICS</h3>
              <div className="grid grid-cols-4 gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-help">
                      <div
                        className={cn(
                          "text-lg font-semibold",
                          getLatencyColor(conversationMetrics.sttStats.avg, "stt"),
                        )}
                      >
                        {formatDuration(conversationMetrics.sttStats.avg)}
                      </div>
                      <div className="text-xs text-muted-foreground">STT</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">Speech-to-Text</div>
                      <div className="text-xs text-muted-foreground">Time to convert speech to text</div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-help">
                      <div
                        className={cn(
                          "text-lg font-semibold",
                          getLatencyColor(conversationMetrics.llmStats.avg, "llm"),
                        )}
                      >
                        {formatDuration(conversationMetrics.llmStats.avg)}
                      </div>
                      <div className="text-xs text-muted-foreground">LLM</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">Language Model</div>
                      <div className="text-xs text-muted-foreground">Time to generate response</div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-help">
                      <div
                        className={cn(
                          "text-lg font-semibold",
                          getLatencyColor(conversationMetrics.ttsStats.avg, "tts"),
                        )}
                      >
                        {formatDuration(conversationMetrics.ttsStats.avg)}
                      </div>
                      <div className="text-xs text-muted-foreground">TTS</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">Text-to-Speech</div>
                      <div className="text-xs text-muted-foreground">Time to convert text to speech</div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-help">
                      <div
                        className={cn(
                          "text-lg font-semibold",
                          getLatencyColor(conversationMetrics.eouStats.avg, "eou"),
                        )}
                      >
                        {formatDuration(conversationMetrics.eouStats.avg)}
                      </div>
                      <div className="text-xs text-muted-foreground">EOU</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">End of Utterance</div>
                      <div className="text-xs text-muted-foreground">Time to detect speech end</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b bg-muted/20">
            <h3 className="font-medium">Conversation Transcript</h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : error ? (
                <div className="text-center py-12 text-destructive">
                  <p>Error loading transcript: {error}</p>
                </div>
              ) : transcriptLogs?.length ? (
                <div className="space-y-6">
                  {/* Metrics-based transcript display */}
                  {transcriptLogs.map((log: TranscriptLog) => (
                    <div key={log.id} className="space-y-4">
                      {/* User Message */}
                      {log.user_transcript && (
                        <div className="flex gap-4 group">
                          <div className="flex-shrink-0 w-12 text-right">
                            <div className="text-xs text-muted-foreground font-mono">
                              {formatConversationTime(log.unix_timestamp)}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                User
                              </Badge>
                            </div>
                            <p className="text-sm leading-relaxed">{log.user_transcript}</p>

                            {/* User Metrics */}
                            <div className="flex gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {log.stt_metrics && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                                      <Mic className="w-3 h-3" />
                                      {formatDuration(log.stt_metrics.duration || 0)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Speech-to-Text processing time</TooltipContent>
                                </Tooltip>
                              )}
                              {log.eou_metrics && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                                      <Clock className="w-3 h-3" />
                                      {formatDuration(log.eou_metrics.end_of_utterance_delay || 0)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>End of utterance detection time</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Agent Response */}
                      {log.agent_response && (
                        <div className="flex gap-4 group">
                          <div className="flex-shrink-0 w-12 text-right">
                            <div className="text-xs text-muted-foreground font-mono">
                              {formatConversationTime(log.unix_timestamp + 1)}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                Agent
                              </Badge>
                            </div>
                            <div className="text-sm leading-relaxed markdown-content">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2" {...props} />,
                                  h2: ({node, ...props}) => <h2 className="text-md font-semibold mb-2" {...props} />,
                                  h3: ({node, ...props}) => <h3 className="text-sm font-medium mb-1" {...props} />,
                                  p: ({node, ...props}) => <p className="mb-2" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                                  ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                                  li: ({node, ...props}) => <li className="ml-2" {...props} />,
                                  strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                                  em: ({node, ...props}) => <em className="italic" {...props} />,
                                  table: ({node, ...props}) => <table className="border-collapse border border-gray-300 w-full mb-4 text-xs" {...props} />,
                                  thead: ({node, ...props}) => <thead className="bg-gray-100" {...props} />,
                                  tbody: ({node, ...props}) => <tbody {...props} />,
                                  tr: ({node, ...props}) => <tr className="border-b border-gray-200" {...props} />,
                                  th: ({node, ...props}) => <th className="border border-gray-300 px-3 py-2 text-xs font-semibold text-left bg-gray-50" {...props} />,
                                  td: ({node, ...props}) => <td className="border border-gray-300 px-3 py-2 text-xs" {...props} />
                                }}
                              >
                                {log.agent_response}
                              </ReactMarkdown>
                            </div>

                            {/* Agent Metrics */}
                            <div className="flex gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {log.llm_metrics && log.tts_metrics && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "flex items-center gap-1 text-xs cursor-help",
                                        getLatencyColor(
                                          (log.llm_metrics.ttft || 0) + (log.tts_metrics.ttfb || 0),
                                          "total",
                                        ),
                                      )}
                                    >
                                      <Activity className="w-3 h-3" />
                                      {formatDuration((log.llm_metrics.ttft || 0) + (log.tts_metrics.ttfb || 0))}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Total response time (LLM + TTS)</TooltipContent>
                                </Tooltip>
                              )}
                              {log.llm_metrics && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "flex items-center gap-1 text-xs cursor-help",
                                        getLatencyColor(log.llm_metrics.ttft || 0, "llm"),
                                      )}
                                    >
                                      <Brain className="w-3 h-3" />
                                      {formatDuration(log.llm_metrics.ttft || 0)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Language model processing time</TooltipContent>
                                </Tooltip>
                              )}
                              {log.tts_metrics && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "flex items-center gap-1 text-xs cursor-help",
                                        getLatencyColor(log.tts_metrics.ttfb || 0, "tts"),
                                      )}
                                    >
                                      <Volume2 className="w-3 h-3" />
                                      {formatDuration(log.tts_metrics.ttfb || 0)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Text-to-speech processing time</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : basicTranscript?.length ? (
                <div className="space-y-6">
                  {/* Basic transcript display - no header needed */}
                  {basicTranscript.map((item: any) => (
                    <div key={item.id} className="space-y-4">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-12 text-right">
                          <div className="text-xs text-muted-foreground font-mono">
                            {item.timestamp ? new Date(item.timestamp * 1000).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit' 
                            }) : `${item.id}`}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={item.role === 'user' ? 'outline' : 'secondary'} className="text-xs">
                              {item.role === 'user' ? 'User' : item.role === 'assistant' ? 'Assistant' : item.role}
                            </Badge>
                          </div>
                          <div className="text-sm leading-relaxed markdown-content">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-md font-semibold mb-2" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-sm font-medium mb-1" {...props} />,
                                p: ({node, ...props}) => <p className="mb-2" {...props} />,
                                ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                                ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                                li: ({node, ...props}) => <li className="ml-2" {...props} />,
                                strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                                em: ({node, ...props}) => <em className="italic" {...props} />,
                                table: ({node, ...props}) => <table className="border-collapse border border-gray-300 w-full mb-4 text-xs" {...props} />,
                                thead: ({node, ...props}) => <thead className="bg-gray-100" {...props} />,
                                tbody: ({node, ...props}) => <tbody {...props} />,
                                tr: ({node, ...props}) => <tr className="border-b border-gray-200" {...props} />,
                                th: ({node, ...props}) => <th className="border border-gray-300 px-3 py-2 text-xs font-semibold text-left bg-gray-50" {...props} />,
                                td: ({node, ...props}) => <td className="border border-gray-300 px-3 py-2 text-xs" {...props} />
                              }}
                            >
                              {item.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
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
