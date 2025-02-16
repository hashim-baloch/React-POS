import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { databases } from "../../config/appwrite";
import { Query } from "appwrite";
import { setProducts } from "./inventorySlice";
import { setPurchases } from "./purchaseSlice";
import { loadSales } from "./salesSlice";
import { setExpenses } from "./expenseSlice";
import { updateProfilePictureUrl } from "./userSlice";

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const COLLECTION_IDS = {
  inventory: import.meta.env.VITE_INVENTORY_COLLECTION,
  sales: import.meta.env.VITE_SALES_COLLECTION,
  purchases: import.meta.env.VITE_PURCHASES_COLLECTION,
  expenses: import.meta.env.VITE_EXPENSES_COLLECTION,
  user: import.meta.env.VITE_USERS_COLLECTION,
};

const fetchCollectionData = async (collectionId, userId) => {
  try {
    const response = await databases.listDocuments(DATABASE_ID, collectionId, [
      Query.equal("userId", userId),
    ]);

    if (response.documents.length > 0) {
      return JSON.parse(response.documents[0].data);
    }

    // Return default state structures if no data exists
    switch (collectionId) {
      case COLLECTION_IDS.inventory:
        return { products: [] };
      case COLLECTION_IDS.sales:
        return { sales: [], todayTotal: 0 };
      case COLLECTION_IDS.purchases:
        return { purchases: [] };
      case COLLECTION_IDS.expenses:
        return {
          expenses: [],
          categories: [
            "Rent",
            "Salaries",
            "Utilities",
            "Supplies",
            "Marketing",
            "Insurance",
            "Maintenance",
            "Other",
          ],
        };
      case COLLECTION_IDS.user:
        return { settings: {}, profilePictureUrl: "" };
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error fetching ${collectionId}:`, error);
    return null;
  }
};

export const syncUserData = createAsyncThunk(
  "auth/syncUserData",
  async (userId, { dispatch }) => {
    if (!userId) return false;

    try {
      const results = await Promise.allSettled([
        fetchCollectionData(COLLECTION_IDS.inventory, userId),
        fetchCollectionData(COLLECTION_IDS.sales, userId),
        fetchCollectionData(COLLECTION_IDS.purchases, userId),
        fetchCollectionData(COLLECTION_IDS.expenses, userId),
        fetchCollectionData(COLLECTION_IDS.user, userId),
      ]);

      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value) {
          switch (index) {
            case 0: // inventory
              dispatch(setProducts(result.value.products || []));
              break;
            case 1: // sales
              dispatch(loadSales(result.value.sales || []));
              break;
            case 2: // purchases
              dispatch(setPurchases(result.value.purchases || []));
              break;
            case 3: // expenses
              dispatch(setExpenses(result.value));
              break;
            case 4: // user data
              dispatch(
                updateProfilePictureUrl(result.value.profilePictureUrl || "")
              );
              break;
          }
        }
      });
      return true;
    } catch (error) {
      console.error("Error syncing user data:", error);
      return false;
    }
  }
);

const initialState = {
  user: null,
  loading: false,
  error: null,
  syncing: false,
  dataLoaded: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action) => {
      const userData = action.payload;
      state.user = {
        id: userData.id || userData.$id,
        email: userData.email,
        name: userData.name,
        createdAt: userData.$createdAt || userData.createdAt,
      };
      state.loading = false;
      state.error = null;
    },
    clearUser: (state) => {
      state.user = null;
      state.loading = false;
      state.error = null;
      state.dataLoaded = false;
      sessionStorage.clear();
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncUserData.pending, (state) => {
        state.syncing = true;
      })
      .addCase(syncUserData.fulfilled, (state) => {
        state.syncing = false;
        state.dataLoaded = true;
      })
      .addCase(syncUserData.rejected, (state) => {
        state.syncing = false;
        state.error = "Failed to sync user data";
      });
  },
});

export const { setUser, clearUser, setLoading, setError } = authSlice.actions;
export default authSlice.reducer;
