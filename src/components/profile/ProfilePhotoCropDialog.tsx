import { useCallback, useLayoutEffect, useState } from 'react'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import SentinelModal from '../shared/SentinelModal'

type ProfilePhotoCropDialogProps = {
  imageSource: string | null
  open: boolean
  onClose: () => void
  onConfirm: (profilePhoto: string) => Promise<void>
}

const OUTPUT_SIZE = 512

const loadImage = (source: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('Unable to prepare this image. Choose a different photo and try again.'))
  image.src = source
})

export const createCroppedProfilePhoto = async (imageSource: string, crop: Area): Promise<string> => {
  const image = await loadImage(imageSource)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to prepare this image. Choose a different photo and try again.')
  }

  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  )

  return canvas.toDataURL('image/png')
}

const ProfilePhotoCropDialog = ({ imageSource, open, onClose, onConfirm }: ProfilePhotoCropDialogProps) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useLayoutEffect(() => {
    if (!open) return
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setProcessing(false)
    setError('')
  }, [imageSource, open])

  const handleCropComplete = useCallback((_croppedArea: Area, cropPixels: Area) => {
    setCroppedAreaPixels(cropPixels)
  }, [])

  const handleConfirm = async () => {
    if (!imageSource || !croppedAreaPixels || processing) return

    setProcessing(true)
    setError('')
    try {
      const profilePhoto = await createCroppedProfilePhoto(imageSource, croppedAreaPixels)
      await onConfirm(profilePhoto)
      onClose()
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : 'Unable to upload photo. Try again.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <SentinelModal
      open={open}
      onClose={processing ? () => undefined : onClose}
      title="Position profile photo"
      subtitle="Drag the image to choose what appears in your profile photo."
      size="md"
      dismissible={!processing}
    >
      <div className="space-y-5">
        <div className="relative h-72 overflow-hidden rounded-md border border-border bg-surface sm:h-80">
          {imageSource ? (
            <Cropper
              image={imageSource}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          ) : null}
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="profile-photo-zoom" className="soc-form-label mb-0">Zoom</label>
            <span className="text-xs text-text-tertiary">Drag image to position</span>
          </div>
          <input
            id="profile-photo-zoom"
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="mt-3 w-full accent-cyan-400"
            disabled={processing}
          />
        </div>

        {error ? <p className="soc-alert-error rounded p-3 text-sm" role="alert">{error}</p> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={processing} className="soc-btn-neutral min-h-11 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => void handleConfirm()} disabled={!croppedAreaPixels || processing} className="soc-btn min-h-11 disabled:cursor-not-allowed disabled:opacity-50">
            {processing ? 'Saving Photo...' : 'Use Photo'}
          </button>
        </div>
      </div>
    </SentinelModal>
  )
}

export default ProfilePhotoCropDialog
