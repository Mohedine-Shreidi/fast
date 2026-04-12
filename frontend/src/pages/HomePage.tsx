import { useEffect, useState } from 'react'

import { apiFetch } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type {
    AverageAgeResponse,
    CountResponse,
    TopCitiesResponse,
} from '../types/auth'

interface StatsState {
    totalUsers: number
    averageAge: number
    topCities: { city: string; count: number }[]
}

const fallbackStats: StatsState = {
    totalUsers: 0,
    averageAge: 0,
    topCities: [],
}

const ramHighlights = [
    {
        title: 'Velocity DDR5 16GB',
        detail: '5600MHz, CL36, best for creator workflows',
    },
    {
        title: 'Titan DDR5 32GB Kit',
        detail: '6000MHz dual-channel for gaming and editing',
    },
    {
        title: 'Steady DDR4 16GB',
        detail: '3200MHz budget build favorite',
    },
]

export function HomePage() {
    const { token } = useAuth()
    const [stats, setStats] = useState<StatsState>(fallbackStats)
    const [error, setError] = useState<string>('')

    useEffect(() => {
        if (!token) {
            setStats(fallbackStats)
            setError('Sign in to view live customer stats.')
            return
        }

        const fetchStats = async () => {
            try {
                const [count, average, topCities] = await Promise.all([
                    apiFetch<CountResponse>('/stats/count', {}, token),
                    apiFetch<AverageAgeResponse>('/stats/average-age', {}, token),
                    apiFetch<TopCitiesResponse>('/stats/top-cities', {}, token),
                ])

                setStats({
                    totalUsers: count.total_users,
                    averageAge: average.average_age,
                    topCities: topCities.top_cities,
                })
            } catch {
                setError('Stats are unavailable until the backend and database are running.')
            }
        }

        fetchStats().catch(() => setError('Could not load stats.'))
    }, [token])

    return (
        <section className="stack-lg">
            <div className="hero-card">
                <p className="eyebrow">RAM Selling Website</p>
                <h1>Performance memory for creators, gamers, and builders.</h1>
                <p>
                    Browse curated RAM kits and monitor customer activity with role-based admin tools.
                </p>
            </div>

            <div className="stats-grid" aria-live="polite" aria-label="Live customer stats">
                <article>
                    <p>Total users</p>
                    <strong>{stats.totalUsers}</strong>
                </article>
                <article>
                    <p>Average age</p>
                    <strong>{stats.averageAge.toFixed(2)}</strong>
                </article>
                <article>
                    <p>Top cities</p>
                    <strong>
                        {stats.topCities.length
                            ? stats.topCities.map((item) => `${item.city} (${item.count})`).join(', ')
                            : 'No data'}
                    </strong>
                </article>
            </div>

            {error && (
                <p className="error-text" role="alert" aria-live="assertive">
                    {error}
                </p>
            )}

            <section className="cards-grid" aria-label="RAM Highlights">
                {ramHighlights.map((item) => (
                    <article key={item.title} className="product-card">
                        <h2>{item.title}</h2>
                        <p>{item.detail}</p>
                    </article>
                ))}
            </section>
        </section>
    )
}
