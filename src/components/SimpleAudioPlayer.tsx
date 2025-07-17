'use client'
import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, Loader2, AlertCircle } from 'lucide-react'

interface SimpleAudioPlayerProps {
  s3Key: string // Just the S3 key, not full URL
  callId: string
}

const SimpleAudioPlayer: React.FC<SimpleAudioPlayerProps> = ({ s3Key, callId }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  
  const audioRef = useRef<HTMLAudioElement>(null)

  // Get presigned URL from API
  const getAudioUrl = async () => {
    if (audioUrl) return audioUrl // Return cached URL
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key })
      })
      
      if (!response.ok) throw new Error('Failed to get audio URL')
      
      const { url } = await response.json()
      setAudioUrl(url)
      return url
    } catch (err) {
      setError('Failed to load audio')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  // Handle play/pause
  const togglePlay = async () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      const url = await getAudioUrl()
      if (url) {
        audioRef.current.src = url
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => setDuration(audio.duration)
    const handleEnded = () => setIsPlaying(false)
    const handleError = () => {
      setError('Playback failed')
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [])

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    
    const newTime = parseFloat(e.target.value)
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm">
        <AlertCircle className="w-4 h-4" />
        Audio unavailable
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 bg-gray-700 rounded-lg p-2 min-w-0">
      <audio ref={audioRef} preload="none" />
      
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className="flex-shrink-0 w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-full flex items-center justify-center transition-colors"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-white" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4 text-white" />
        ) : (
          <Play className="w-4 h-4 text-white ml-0.5" />
        )}
      </button>

      {/* Progress Bar (only show if duration > 0) */}
      {duration > 0 && (
        <div className="flex-1 min-w-0">
          <input
            type="range"
            min="0"
            max={duration}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default SimpleAudioPlayer