document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('productsBody');
    const modal = document.getElementById('productModal');
    const addBtn = document.getElementById('addBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const form = document.getElementById('productForm');
    const modalTitle = document.getElementById('modalTitle');
    
    // Fetch and display products
    async function fetchProducts() {
        try {
            const response = await fetch('/api/products');
            const products = await response.json();
            renderTable(products);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    }

    function renderTable(products) {
        tableBody.innerHTML = '';
        if (products.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No products found. Add one!</td></tr>';
            return;
        }

        products.forEach(product => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${product.id}</td>
                <td>${product.family}</td>
                <td>${product.spec}</td>
                <td>${product.make}</td>
                <td>${product.stock}</td>
                <td>$${product.price.toFixed(2)}</td>
                <td class="actions">
                    <button class="btn btn-edit" onclick="editProduct(${product.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteProduct(${product.id})">Delete</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // Modal Logic
    function openModal(isEdit = false) {
        modal.classList.add('show');
        modalTitle.textContent = isEdit ? 'Edit Product' : 'Add Product';
    }

    function closeModal() {
        modal.classList.remove('show');
        form.reset();
        document.getElementById('productId').value = '';
    }

    addBtn.addEventListener('click', () => openModal(false));
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Form Submission (Add or Edit)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const productId = document.getElementById('productId').value;
        const productData = {
            family: document.getElementById('family').value,
            spec: document.getElementById('spec').value,
            make: document.getElementById('make').value,
            stock: parseInt(document.getElementById('stock').value),
            price: parseFloat(document.getElementById('price').value)
        };

        const isEdit = productId !== '';
        const url = isEdit ? `/api/products/${productId}` : '/api/products';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });

            if (response.ok) {
                closeModal();
                fetchProducts();
            }
        } catch (error) {
            console.error('Error saving product:', error);
        }
    });

    // Delete Product
    window.deleteProduct = async (id) => {
        if (confirm('Are you sure you want to delete this product?')) {
            try {
                const response = await fetch(`/api/products/${id}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    fetchProducts();
                }
            } catch (error) {
                console.error('Error deleting product:', error);
            }
        }
    };

    // Edit Product
    window.editProduct = async (id) => {
        try {
            // In a real app we might fetch by ID, but we can also just fetch all and find it
            const response = await fetch('/api/products');
            const products = await response.json();
            const product = products.find(p => p.id === id);
            
            if (product) {
                document.getElementById('productId').value = product.id;
                document.getElementById('family').value = product.family;
                document.getElementById('spec').value = product.spec;
                document.getElementById('make').value = product.make;
                document.getElementById('stock').value = product.stock;
                document.getElementById('price').value = product.price;
                openModal(true);
            }
        } catch (error) {
            console.error('Error preparing edit:', error);
        }
    };

    // Initial fetch
    fetchProducts();
});
