import { useState, useCallback, useEffect } from "react";
import ProductCard, { type Product } from "./ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { Search, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

// API response types
interface PaginatedProductsResponse {
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type ProductsResponse = Product[] | PaginatedProductsResponse;

interface ProductGridProps {
  onAddToCart?: (product: Product) => void;
  onToggleFavorite?: (productId: string) => void;
  title?: string;
  showPagination?: boolean;
  initialPageSize?: number;
}

export default function ProductGrid({ 
  onAddToCart, 
  onToggleFavorite,
  title = "Our Collection",
  showPagination = true,
  initialPageSize = 12
}: ProductGridProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [majorCategoryFilter, setMajorCategoryFilter] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, majorCategoryFilter, sortBy]);
  
  // Build query key for TanStack Query caching (separate from API URL construction)
  const queryKey = [
    '/api/products',
    'page', currentPage,
    'limit', pageSize,
    'search', searchTerm,
    'category', categoryFilter,
    'majorCategory', majorCategoryFilter,
    'sort', sortBy,
    'paginated', showPagination
  ] as const;
  
  // Fetch products with pagination
  const { data: productsResponse, isLoading, error } = useQuery<ProductsResponse>({
    queryKey,
    queryFn: async () => {
      if (!showPagination) {
        // Legacy mode - no pagination parameters
        const response = await fetch("/api/products", {
          credentials: "include",
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch products: ${response.statusText}`);
        }
        
        return response.json();
      }
      
      // Paginated mode with query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });
      
      // Add search parameter if present
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      
      // Add category filter if present
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      
      // Add major category filter if present
      if (majorCategoryFilter !== 'all') {
        params.append('majorCategory', majorCategoryFilter);
      }
      
      // Add sort parameter if present
      if (sortBy) {
        params.append('sort', sortBy);
      }
      
      const response = await fetch(`/api/products?${params.toString()}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.statusText}`);
      }
      
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Helper function to check if response is paginated
  const isPaginatedResponse = (response: ProductsResponse | undefined): response is PaginatedProductsResponse => {
    return response != null && typeof response === 'object' && 'data' in response && 'pagination' in response;
  };
  
  // Extract products and pagination info with proper undefined handling
  const products = productsResponse && isPaginatedResponse(productsResponse) 
    ? productsResponse.data 
    : Array.isArray(productsResponse) 
      ? productsResponse 
      : [];
  const pagination = productsResponse && isPaginatedResponse(productsResponse) 
    ? productsResponse.pagination 
    : null;
  
  // Get all categories for filter dropdown (we need this for the category select)
  const { data: allCategories = [] } = useQuery<any[]>({
    queryKey: ['/api/categories'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Get unique categories from API or fallback to product categories
  const categories = allCategories.length > 0 
    ? allCategories.map(cat => cat.name)
    : Array.from(new Set(products.map(p => p.category)));
  
  // Major categories for better filtering
  const majorCategories = [
    { value: "all", label: "All Products" },
    { value: "men", label: "Men's Perfumes" },
    { value: "women", label: "Women's Perfumes" },
    { value: "unisex", label: "Unisex Fragrances" }
  ];

  // Helper function to determine major category
  const getMajorCategory = (product: Product) => {
    const name = product.name.toLowerCase();
    const description = product.description.toLowerCase();
    const category = product.category.toLowerCase();
    
    // Check for men's keywords
    if (name.includes('men') || name.includes('homme') || name.includes('masculine') ||
        description.includes('men') || description.includes('homme') || description.includes('masculine') ||
        category.includes('men') || category.includes('homme') || category.includes('masculine')) {
      return 'men';
    }
    
    // Check for women's keywords  
    if (name.includes('women') || name.includes('femme') || name.includes('feminine') ||
        description.includes('women') || description.includes('femme') || description.includes('feminine') ||
        category.includes('women') || category.includes('femme') || category.includes('feminine')) {
      return 'women';
    }
    
    // Check for unisex keywords
    if (name.includes('unisex') || description.includes('unisex') || category.includes('unisex')) {
      return 'unisex';
    }
    
    // Default to unisex if no specific gender indicators
    return 'unisex';
  };

  // For paginated results, filtering and sorting is done server-side
  // For non-paginated results (like featured sections), do client-side filtering and limit
  let totalFilteredCount = 0; // Track total before limiting for accurate count display
  
  const filteredProducts = showPagination && pagination 
    ? products // Server-side filtering/sorting when using pagination
    : (() => {
        // Client-side filtering for backward compatibility
        const filtered = products.filter(product => {
          const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                               product.description.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
          const matchesMajorCategory = majorCategoryFilter === "all" || getMajorCategory(product) === majorCategoryFilter;
          return matchesSearch && matchesCategory && matchesMajorCategory;
        })
        .sort((a, b) => {
          switch (sortBy) {
            case "price-low":
              return a.price - b.price;
            case "price-high":
              return b.price - a.price;
            case "name":
              return a.name.localeCompare(b.name);
            default:
              return 0;
          }
        });
        
        totalFilteredCount = filtered.length; // Store total before limiting
        return filtered.slice(0, initialPageSize); // Limit results for non-paginated views
      })();
  
  // Calculate total for display
  const totalProducts = pagination ? pagination.total : totalFilteredCount || products.length;
  const currentResults = filteredProducts.length;
  
  // Handle pagination
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    // Scroll to top of grid when page changes
    document.getElementById('product-grid-header')?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  
  // Generate page numbers for pagination
  const generatePageNumbers = () => {
    if (!pagination) return [];
    
    const totalPages = pagination.totalPages;
    const current = pagination.page;
    const pages: (number | 'ellipsis')[] = [];
    
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (current > 3) {
        pages.push('ellipsis');
      }
      
      // Show pages around current page
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (current < totalPages - 2) {
        pages.push('ellipsis');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };
  
  // Loading skeleton component
  const ProductGridSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: pageSize }).map((_, index) => (
        <div key={index} className="space-y-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
  
  if (error) {
    return (
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-destructive text-lg">Failed to load products. Please try again.</p>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/products'] })}
              className="mt-4"
              data-testid="button-retry-products"
            >
              Retry
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div id="product-grid-header" className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
            {title}
          </h2>
          <div className="w-24 h-1 bg-primary mx-auto mb-6" />
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="search"
                placeholder="Search perfumes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-products"
              />
            </div>

            {/* Filter Toggle for Mobile */}
            <Button
              variant="outline"
              className="md:hidden hover-elevate"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Filters */}
          <div className={`flex flex-col md:flex-row gap-4 ${isFilterOpen ? 'block' : 'hidden md:flex'}`}>
            {/* Major Categories Filter */}
            <Select value={majorCategoryFilter} onValueChange={setMajorCategoryFilter}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-major-category-filter">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                {majorCategories.map(category => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Specific Categories Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-sort-by">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground" data-testid="text-results-count">
            {pagination 
              ? `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalProducts)} of ${totalProducts} products`
              : `Showing ${currentResults} of ${totalProducts} products`
            }
            {searchTerm && ` for "${searchTerm}"`}
          </p>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <ProductGridSkeleton />
        ) : filteredProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={onAddToCart}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
            
            {/* Pagination */}
            {showPagination && pagination && pagination.totalPages > 1 && (
              <div className="mt-12 flex flex-col items-center space-y-4">
                {/* Page size selector */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Items per page:</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(parseInt(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-20" data-testid="select-page-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6</SelectItem>
                      <SelectItem value="12">12</SelectItem>
                      <SelectItem value="24">24</SelectItem>
                      <SelectItem value="48">48</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Pagination controls */}
                <Pagination data-testid="pagination-controls">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        data-testid="button-previous-page"
                      />
                    </PaginationItem>
                    
                    {generatePageNumbers().map((page, index) => (
                      <PaginationItem key={index}>
                        {page === 'ellipsis' ? (
                          <PaginationEllipsis data-testid={`ellipsis-${index}`} />
                        ) : (
                          <PaginationLink
                            onClick={() => handlePageChange(page as number)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                            data-testid={`button-page-${page}`}
                          >
                            {page}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handlePageChange(Math.min(pagination.totalPages, currentPage + 1))}
                        className={currentPage >= pagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        data-testid="button-next-page"
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                
                {/* Page info */}
                <p className="text-sm text-muted-foreground" data-testid="text-page-info">
                  Page {currentPage} of {pagination.totalPages}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              {searchTerm ? `No products found for "${searchTerm}"` : "No products available"}
            </p>
          </div>
        )}

      </div>
    </section>
  );
}