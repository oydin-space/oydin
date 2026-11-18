"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type CameraStatus = "starting" | "live" | "denied" | "unsupported"
type Facing = "environment" | "user"

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }

/** Live camera preview for the capture view. Streams are stopped on deactivate/unmount and on every flip. */
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>("starting")
  const [facing, setFacing] = useState<Facing>("environment")
  const [canFlip, setCanFlip] = useState(false)
  const [canTorch, setCanTorch] = useState(false)
  const [torch, setTorch] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const devices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices
    const request = devices?.getUserMedia
      ? devices.getUserMedia.bind(devices)
      : () => Promise.reject(new DOMException("getUserMedia unavailable", "NotSupportedError"))
    request({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
        const caps = stream.getVideoTracks()[0]?.getCapabilities?.() as TorchCapabilities | undefined
        setCanTorch(!!caps?.torch)
        setStatus("live")
        const list = await devices?.enumerateDevices().catch(() => [] as MediaDeviceInfo[])
        if (!cancelled) setCanFlip((list ?? []).filter((d) => d.kind === "videoinput").length > 1)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const name = e instanceof DOMException ? e.name : ""
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported")
      })
    return () => {
      cancelled = true
      stop()
      setStatus("starting")
      setTorch(false)
    }
  }, [active, facing, stop])

  const flip = useCallback(() => setFacing((f) => (f === "environment" ? "user" : "environment")), [])

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torch
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorch(next)
    } catch {
      setCanTorch(false)
    }
  }, [torch])

  /** Grabs the current frame as a JPEG file; null when nothing is streaming. */
  const capture = useCallback(async (): Promise<File | null> => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9))
    return blob ? new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }) : null
  }, [])

  return [videoRef, { status, facing, canFlip, canTorch, torch, flip, toggleTorch, capture }] as const
}
