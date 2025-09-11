import { createContext, useContext, useReducer, useEffect, ReactNode } from "react";
import { type Product } from "@/components/ProductCard";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  category: string;
}

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
}

type CartAction =
  | { type: "ADD_ITEM"; product: Product }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "UPDATE_QUANTITY"; id: string; quantity: number }
  | { type: "CLEAR_CART" }
  | { type: "LOAD_CART"; items: CartItem[] };

interface CartContextType {
  state: CartState;
  addItem: (product: Product) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function cartReducer(state: CartState, action: CartAction): CartState {
  let newItems: CartItem[];
  
  switch (action.type) {
    case "ADD_ITEM":
      const existingItem = state.items.find(item => item.id === action.product.id);
      
      if (existingItem) {
        newItems = state.items.map(item =>
          item.id === action.product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        const cartItem: CartItem = {
          id: action.product.id,
          name: action.product.name,
          price: action.product.price,
          image: action.product.image,
          quantity: 1,
          category: action.product.category,
        };
        newItems = [...state.items, cartItem];
      }
      break;

    case "REMOVE_ITEM":
      newItems = state.items.filter(item => item.id !== action.id);
      break;

    case "UPDATE_QUANTITY":
      if (action.quantity <= 0) {
        newItems = state.items.filter(item => item.id !== action.id);
      } else {
        newItems = state.items.map(item =>
          item.id === action.id
            ? { ...item, quantity: action.quantity }
            : item
        );
      }
      break;

    case "CLEAR_CART":
      newItems = [];
      break;

    case "LOAD_CART":
      newItems = action.items;
      break;

    default:
      return state;
  }

  const total = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = newItems.reduce((count, item) => count + item.quantity, 0);

  return {
    items: newItems,
    total,
    itemCount,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    total: 0,
    itemCount: 0,
  });

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("kary-perfumes-cart");
    if (savedCart) {
      try {
        const cartItems = JSON.parse(savedCart);
        dispatch({ type: "LOAD_CART", items: cartItems });
      } catch (error) {
        console.error("Error loading cart from localStorage:", error);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("kary-perfumes-cart", JSON.stringify(state.items));
  }, [state.items]);

  const addItem = (product: Product) => {
    dispatch({ type: "ADD_ITEM", product });
  };

  const removeItem = (id: string) => {
    dispatch({ type: "REMOVE_ITEM", id });
  };

  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", id, quantity });
  };

  const clearCart = () => {
    dispatch({ type: "CLEAR_CART" });
  };

  return (
    <CartContext.Provider value={{
      state,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}