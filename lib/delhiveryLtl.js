import axios from 'axios'

const TOKEN_TTL_MS = 15 * 60 * 1000

let cachedToken = null
let cachedTokenAt = 0

const getBaseUrl = () => {
    const baseUrl = process.env.DELHIVERY_LTL_BASE_URL

    if (!baseUrl) {
        throw new Error('Delhivery LTL base URL is not configured')
    }

    return baseUrl.replace(/\/$/, '')
}

const extractToken = (data) => {
    return (
        data?.token ||
        data?.access_token ||
        data?.data?.token ||
        data?.data?.access_token ||
        data?.session?.token ||
        null
    )
}

export const getLtlToken = async () => {
    if (cachedToken && Date.now() - cachedTokenAt < TOKEN_TTL_MS) {
        return cachedToken
    }

    const baseUrl = getBaseUrl()
    const username = process.env.DELHIVERY_LTL_USERNAME
    const password = process.env.DELHIVERY_LTL_PASSWORD

    if (!username || !password) {
        throw new Error('Delhivery LTL credentials are not configured')
    }

    const url = `${baseUrl}/ums/login`
    const { data } = await axios.post(url, { username, password }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
    })

    const token = extractToken(data)
    if (!token) {
        throw new Error('Delhivery LTL login did not return a token')
    }

    cachedToken = token
    cachedTokenAt = Date.now()
    return token
}

export const ltlRequest = async ({ method, path, params, data, headers }) => {
    const token = await getLtlToken()
    const baseUrl = getBaseUrl()
    const url = new URL(`${baseUrl}${path}`)

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') return
            url.searchParams.set(key, String(value))
        })
    }

    const response = await axios({
        method,
        url: url.toString(),
        data,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...headers
        },
        timeout: 10000
    })

    return response.data
}
