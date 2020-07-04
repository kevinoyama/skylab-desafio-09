import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('User does not exist', 400);
    }

    const productsIDs = products.map(product => {
      return { id: product.id };
    });

    const allProducts = await this.productsRepository.findAllById(productsIDs);

    if (!allProducts || allProducts.length !== products.length) {
      throw new AppError('Product(s) do(es) not exist', 400);
    }

    const newProducts = allProducts.map(product => {
      const requestProduct = products.find(prod => prod.id === product.id);

      if (product.quantity - (requestProduct?.quantity || 1) < 0) {
        throw new AppError(
          'Product does not have this quantity available.',
          400,
        );
      }

      return {
        product_id: product.id,
        price: product.price,
        quantity: requestProduct?.quantity || 1,
      };
    });

    const updateQuantity = allProducts.map(product => {
      const requestProduct = products.find(prod => prod.id === product.id);

      return {
        id: product.id,
        quantity: product.quantity - (requestProduct?.quantity || 1),
      };
    });

    await this.productsRepository.updateQuantity(updateQuantity);

    const order = await this.ordersRepository.create({
      customer,
      products: newProducts,
    });

    delete order.customer_id;

    return order;
  }
}

export default CreateOrderService;
