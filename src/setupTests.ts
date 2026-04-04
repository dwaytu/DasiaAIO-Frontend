import '@testing-library/jest-dom';

// react-router v7 requires TextEncoder/TextDecoder in jsdom
if (typeof globalThis.TextEncoder === 'undefined') {
	const { TextEncoder, TextDecoder } = require('util')
	globalThis.TextEncoder = TextEncoder
	globalThis.TextDecoder = TextDecoder
}

// react-router v7 requires web stream/fetch APIs in jsdom
// Node.js 24 provides these natively but jsdom doesn't expose them
if (typeof globalThis.ReadableStream === 'undefined') {
	const { ReadableStream, WritableStream, TransformStream } = require('stream/web')
	globalThis.ReadableStream = ReadableStream
	globalThis.WritableStream = WritableStream
	globalThis.TransformStream = TransformStream
}
if (typeof globalThis.MessagePort === 'undefined') {
	const { MessagePort, MessageChannel } = require('worker_threads')
	globalThis.MessagePort = MessagePort
	globalThis.MessageChannel = MessageChannel
}
if (typeof globalThis.Request === 'undefined') {
	const { Request, Response, Headers, fetch } = require('undici')
	globalThis.Request = Request
	globalThis.Response = Response
	globalThis.Headers = Headers
	if (typeof globalThis.fetch === 'undefined') {
		globalThis.fetch = fetch
	}
}

if (typeof window !== 'undefined' && !window.matchMedia) {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: (query: string) => ({
			matches: query.includes('dark'),
			media: query,
			onchange: null,
			addListener: jest.fn(),
			removeListener: jest.fn(),
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			dispatchEvent: jest.fn(),
		}),
	});
}
