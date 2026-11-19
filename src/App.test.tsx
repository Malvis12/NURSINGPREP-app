import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App smoke test', () => {
  it('renders the h1 and Join Nursing Prep button', () => {
    render(<App />)
    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'Your next level starts with practice.',
    })
    expect(heading).toBeDefined()
    expect(heading.textContent).toBe('Your next level starts with practice.')

    const joinButton = screen.getByRole('button', { name: 'Join Nursing Prep' })
    expect(joinButton).toBeDefined()
    expect(joinButton.textContent).toBe('Join Nursing Prep')
  })
})
