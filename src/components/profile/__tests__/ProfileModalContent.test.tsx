import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileModalContent from '../ProfileModalContent'

const updateUser = jest.fn()

jest.mock('../../../config', () => ({ API_BASE_URL: 'http://localhost:5000' }))
jest.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ updateUser }) }))
jest.mock('react-easy-crop', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: ({ onCropComplete }: { onCropComplete: (area: unknown, pixels: { x: number; y: number; width: number; height: number }) => void }) => {
      React.useEffect(() => onCropComplete({}, { x: 0, y: 0, width: 100, height: 100 }), [onCropComplete])
      return <div data-testid="profile-photo-cropper" />
    },
  }
})

const guard = {
  id: 'guard-1',
  email: 'guard@example.test',
  username: 'guard.operator',
  role: 'guard' as const,
  fullName: 'Guard Operator',
  phoneNumber: '09171234567',
  profilePhoto: 'data:image/png;base64,photo',
}

describe('ProfileModalContent', () => {
  let canvasContextSpy: jest.SpyInstance
  let canvasDataUrlSpy: jest.SpyInstance

  beforeEach(() => {
    updateUser.mockReset()
    localStorage.setItem('token', 'test-token')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:profile-photo') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() })
    Object.defineProperty(global, 'Image', {
      configurable: true,
      value: class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        set src(_value: string) { this.onload?.() }
      },
    })
    canvasContextSpy = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: jest.fn() } as unknown as CanvasRenderingContext2D)
    canvasDataUrlSpy = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,cropped-photo')
    global.fetch = jest.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      guard_code: 'G-0042', verified: true, last_seen_at: '2026-09-20T08:00:00Z', created_at: '2026-01-01T08:00:00Z', updated_at: '2026-09-19T08:00:00Z',
    }), { status: 200 })))
  })

  afterEach(() => {
    canvasContextSpy.mockRestore()
    canvasDataUrlSpy.mockRestore()
  })

  it('separates guard credentials and real account metadata from editable personal details', async () => {
    render(<ProfileModalContent user={guard} />)

    expect(screen.getByRole('heading', { name: 'Personal Information' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'License and Credentials' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Account Information' })).toBeInTheDocument()
    expect(screen.queryByLabelText('User ID')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Profile' })).toBeDisabled()
    await waitFor(() => expect(screen.getByText('G-0042')).toBeInTheDocument())
  })

  it('requires a confirmation before removing a profile photo', async () => {
    const user = userEvent.setup()
    render(<ProfileModalContent user={guard} />)
    await screen.findByText('G-0042')

    await user.click(screen.getByRole('button', { name: 'Remove Photo' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Remove profile photo?')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('lets the user position a supported photo before uploading the cropped PNG', async () => {
    const user = userEvent.setup()
    render(<ProfileModalContent user={guard} />)
    await screen.findByText('G-0042')

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, new File(['photo'], 'profile.png', { type: 'image/png' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Position profile photo')
    expect(screen.getByTestId('profile-photo-cropper')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Use Photo' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Use Photo' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    const [, request] = (global.fetch as jest.Mock).mock.calls[1]
    expect(request).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ profilePhoto: 'data:image/png;base64,cropped-photo' }),
    })
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('http://localhost:5000/api/user/guard-1/profile-photo')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('rejects GIF files before opening the photo-position dialog', async () => {
    render(<ProfileModalContent user={guard} />)
    await screen.findByText('G-0042')

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File(['photo'], 'profile.gif', { type: 'image/gif' })] } })

    expect(screen.getByText('Choose a JPG, PNG, or WebP image.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
