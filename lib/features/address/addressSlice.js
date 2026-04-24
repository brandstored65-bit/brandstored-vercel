import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import axios from 'axios'

export const fetchAddress = createAsyncThunk('address/fetchAddress', 
    async ({ getToken }, thunkAPI) => {
        try {
            const token = await getToken()
            if (!token) {
                return thunkAPI.rejectWithValue({ error: 'Unauthorized' })
            }
            const { data } = await axios.get('/api/address', {headers: { Authorization: `Bearer ${token}` }})
            return data ? data.addresses : []
        } catch (error) {
            return thunkAPI.rejectWithValue(error?.response?.data || { error: 'Failed to fetch addresses' })
        }
    }
)


const addressSlice = createSlice({
    name: 'address',
    initialState: {
        list: [],
        error: null,
    },
    reducers: {
        addAddress: (state, action) => {
            state.list.push(action.payload)
        },
    },
    extraReducers: (builder) => {
        builder.addCase(fetchAddress.fulfilled, (state, action) => {
            state.list = action.payload;
            state.error = null;
        });
        builder.addCase(fetchAddress.rejected, (state, action) => {
            const fallbackMessage = action.error?.message && action.error.message !== 'Rejected'
                ? action.error.message
                : 'Failed to fetch addresses';
            state.error = action.payload?.error || fallbackMessage;
            state.list = [];
        });
    }
});

export const { addAddress } = addressSlice.actions

export default addressSlice.reducer