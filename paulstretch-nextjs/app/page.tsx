'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Upload, Download, Play, Pause, Settings, Gauge, FileAudio, Volume2 } from 'lucide-react'
import { Toast } from '@/components/ui/toast'
import WaveSurfer from 'wavesurfer.js'

interface ToastState {
  show: boolean
  title?: string
  description?: string
  type?: 'success' | 'error' | 'warning' | 'info'
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stretchFactor, setStretchFactor] = useState([8])
  const [windowSize, setWindowSize] = useState([0.05])
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [toast, setToast] = useState<ToastState>({ show: false })
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState([1])
  const audioRef = useRef<HTMLAudioElement>(null)
  const paulStretchRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)

  useEffect(() => {
    import('paulstretch').then((module) => {
      paulStretchRef.current = module.default
    })
  }, [])

  // Initialize WaveSurfer when outputUrl changes
  useEffect(() => {
    if (outputUrl && waveformRef.current) {
      // Destroy previous instance if exists
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
      }

      // Create new WaveSurfer instance with SoundCloud-like styling
      const isDark = document.documentElement.classList.contains('dark')
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: isDark ? '#475569' : '#64748b',
        progressColor: isDark ? '#3b82f6' : '#3b82f6',
        cursorColor: isDark ? '#3b82f6' : '#3b82f6',
        barWidth: 2,
        barRadius: 2,
        barGap: 1,
        height: 128,
        normalize: true,
        backend: 'WebAudio',
        interact: true,
        cursorWidth: 1,
        hideScrollbar: true,
        autoScroll: true,
        autoCenter: true,
        mediaControls: false,
      })

      // Load the audio with error handling
      // First, test if the blob URL is valid
      fetch(outputUrl)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
          console.log('Blob URL is valid, size:', arrayBuffer.byteLength)
          // Try to decode with AudioContext first
          const testContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          return testContext.decodeAudioData(arrayBuffer.slice(0))
        })
        .then(audioBuffer => {
          console.log('AudioContext decode successful, duration:', audioBuffer.duration)
          // If decode succeeds, load in WaveSurfer
          return wavesurferRef.current?.load(outputUrl)
        })
        .catch((error) => {
          console.error('Audio loading/decoding error:', error)
          showToast('Audio Loading Error', 'Failed to load audio in waveform viewer. Using fallback player.', 'warning')
          // Fall back to regular audio element
          if (audioRef.current) {
            audioRef.current.src = outputUrl
            audioRef.current.style.display = 'block'
          }
        })

      // Set up event listeners
      wavesurferRef.current.on('ready', () => {
        setDuration(wavesurferRef.current!.getDuration())
      })
      
      wavesurferRef.current.on('error', (error) => {
        console.error('WaveSurfer error:', error)
      })

      wavesurferRef.current.on('audioprocess', () => {
        setCurrentTime(wavesurferRef.current!.getCurrentTime())
      })

      wavesurferRef.current.on('play', () => {
        setIsPlaying(true)
      })

      wavesurferRef.current.on('pause', () => {
        setIsPlaying(false)
      })

      wavesurferRef.current.on('finish', () => {
        setIsPlaying(false)
        setCurrentTime(0)
      })
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
        wavesurferRef.current = null
      }
    }
  }, [outputUrl])

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const showToast = (title: string, description?: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ show: true, title, description, type })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      // Stop any playing audio and clean up
      if (wavesurferRef.current) {
        wavesurferRef.current.stop()
        wavesurferRef.current.destroy()
        wavesurferRef.current = null
      }
      
      // Clean up old blob URL to free memory
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl)
      }
      
      setFile(e.target.files[0])
      setOutputUrl(null)
      setPerformanceMetrics(null)
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      showToast('File Selected', `${e.target.files[0].name} is ready for processing`, 'success')
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const processAudio = async () => {
    if (!file || !paulStretchRef.current) return

    // Stop any playing audio and clean up before processing
    if (wavesurferRef.current) {
      wavesurferRef.current.stop()
      wavesurferRef.current.destroy()
      wavesurferRef.current = null
    }
    
    // Clean up old blob URL to free memory
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl)
    }
    
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setOutputUrl(null)
    setProcessing(true)
    setProgress(0)
    
    try {
      const startTime = performance.now()
      
      // Initialize with stretch parameters
      const paulstretch = new paulStretchRef.current({
        stretchFactor: stretchFactor[0],
        windowSize: windowSize[0]
      })
      
      // Load audio first, then stretch with progress tracking
      const audioBuffer = await paulstretch.loadAudio(file)
      
      // Set up progress tracking via callback parameter
      let lastProgress = 0
      const stretchedBuffer = await paulstretch.stretch(audioBuffer, (prog: number) => {
        const actualProgress = Math.round(prog * 100)
        // Only update if progress actually changed
        if (actualProgress !== lastProgress) {
          setProgress(actualProgress)
          lastProgress = actualProgress
        }
      })
      
      // Convert to blob for playback/download
      const blob = await paulstretch.toBlob(stretchedBuffer)
      
      const endTime = performance.now()
      const processingTime = ((endTime - startTime) / 1000).toFixed(2)
      
      const url = URL.createObjectURL(blob)
      setOutputUrl(url)
      
      setPerformanceMetrics({
        processingTime,
        inputSize: (file.size / 1024 / 1024).toFixed(2),
        outputSize: (blob.size / 1024 / 1024).toFixed(2),
        stretchFactor: stretchFactor[0],
        windowSize: windowSize[0]
      })
      
      setProgress(100)
      showToast('Processing Complete!', `Your audio has been stretched by ${stretchFactor[0]}x`, 'success')
    } catch (error) {
      console.error('Processing error:', error)
      showToast('Processing Error', (error as Error).message, 'error')
    } finally {
      setProcessing(false)
      setProgress(0)
    }
  }

  const togglePlayback = () => {
    if (!wavesurferRef.current) return
    
    if (isPlaying) {
      wavesurferRef.current.pause()
    } else {
      wavesurferRef.current.play()
    }
  }

  const downloadAudio = () => {
    if (!outputUrl) return
    
    const a = document.createElement('a')
    a.href = outputUrl
    a.download = `stretched_${file?.name || 'audio.wav'}`
    a.click()
    
    showToast('Download Started', 'Your processed audio file is being downloaded', 'info')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-[#0f172a] dark:via-[#1e293b] dark:to-[#334155] p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 pt-8">
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Extreme time-stretching audio processor using Paul's advanced algorithm. 
            Stretch your audio files up to 50x without pitch changes.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Upload Section */}
          <Card className="col-span-full md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Audio File
              </CardTitle>
              <CardDescription>
                Select an audio file to process. Supports MP3, WAV, OGG and more.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button 
                variant="outline" 
                className="w-full h-24 border-2 border-dashed hover:border-primary/50 hover:bg-primary/5"
                onClick={handleUploadClick}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-6 h-6" />
                  <span>Choose Audio File</span>
                </div>
              </Button>
              
              {file && (
                <div className="p-4 bg-secondary/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <FileAudio className="w-5 h-5 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Processing Settings
              </CardTitle>
              <CardDescription>
                Adjust the stretch parameters for optimal results.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">Stretch Factor</label>
                  <span className="text-sm font-mono bg-secondary px-2 py-1 rounded">
                    {stretchFactor[0]}x
                  </span>
                </div>
                <Slider
                  value={stretchFactor}
                  onValueChange={setStretchFactor}
                  min={2}
                  max={50}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Higher values create more extreme time stretching
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">Window Size</label>
                  <span className="text-sm font-mono bg-secondary px-2 py-1 rounded">
                    {windowSize[0].toFixed(3)}s
                  </span>
                </div>
                <Slider
                  value={windowSize}
                  onValueChange={setWindowSize}
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Smaller windows preserve detail, larger windows reduce artifacts
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Processing Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5" />
              Audio Processing
            </CardTitle>
            <CardDescription>
              Process your audio file with the selected parameters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={processAudio}
              disabled={!file || processing}
              size="lg"
              className="w-full"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent mr-2" />
                  Processing... {progress}%
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Process Audio
                </>
              )}
            </Button>
            
            {processing && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  Processing your audio file...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        {performanceMetrics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="w-5 h-5" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-secondary/30 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{performanceMetrics.processingTime}s</p>
                  <p className="text-sm text-muted-foreground">Processing Time</p>
                </div>
                <div className="text-center p-4 bg-secondary/30 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{performanceMetrics.inputSize}</p>
                  <p className="text-sm text-muted-foreground">Input Size (MB)</p>
                </div>
                <div className="text-center p-4 bg-secondary/30 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{performanceMetrics.outputSize}</p>
                  <p className="text-sm text-muted-foreground">Output Size (MB)</p>
                </div>
                <div className="text-center p-4 bg-secondary/30 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{performanceMetrics.stretchFactor}x</p>
                  <p className="text-sm text-muted-foreground">Stretch Factor</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Output Section - Compact Player */}
        {outputUrl && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <FileAudio className="w-5 h-5" />
                Processed Audio
              </CardTitle>
              <CardDescription>
                Your processed audio is ready for playback and download.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Compact SoundCloud-style Player */}
              <div className="space-y-3">
                {/* Waveform with everything overlaid */}
                <div className="relative group">
                  {/* Play button overlay */}
                  <Button
                    variant="default"
                    size="icon"
                    onClick={togglePlayback}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-orange-500 hover:bg-orange-600 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-lg transition-all"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </Button>
                  
                  {/* Track info overlay */}
                  <div className="absolute left-20 top-4 z-10">
                    <h3 className="font-semibold text-sm text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {file?.name ? `Stretched: ${file.name}` : 'Stretched Audio'}
                    </h3>
                    <p className="text-xs text-gray-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {stretchFactor[0]}x stretch | {windowSize[0].toFixed(3)}s window
                    </p>
                  </div>
                  
                  {/* Time overlays */}
                  <div className="absolute bottom-3 left-20 z-10 text-xs font-mono text-white font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {formatTime(currentTime)}
                  </div>
                  <div className="absolute bottom-3 right-3 z-10 text-xs font-mono text-white font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {formatTime(duration)}
                  </div>
                  
                  {/* Volume control overlay - shows on hover */}
                  <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded px-3 py-2">
                      <Volume2 className="w-4 h-4 text-white" />
                      <Slider
                        value={volume}
                        onValueChange={(value) => {
                          setVolume(value)
                          if (wavesurferRef.current) {
                            wavesurferRef.current.setVolume(value[0])
                          }
                        }}
                        min={0}
                        max={1}
                        step={0.01}
                        className="w-20"
                      />
                    </div>
                  </div>
                  
                  {/* Waveform container */}
                  <div 
                    ref={waveformRef} 
                    id="waveform"
                    className="w-full h-32 rounded bg-gradient-to-b from-slate-700 to-slate-800 dark:from-slate-800/50 dark:to-slate-900/50"
                  />
                </div>
              </div>
              
              {/* Hidden audio element for fallback */}
              <audio
                ref={audioRef}
                src={outputUrl}
                className="hidden"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              
              <Button onClick={downloadAudio} variant="default" size="lg" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Download Processed Audio
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Toast Notifications */}
      {toast.show && (
        <Toast
          title={toast.title}
          description={toast.description}
          type={toast.type}
          onClose={() => setToast({ show: false })}
        />
      )}
    </div>
  )
}