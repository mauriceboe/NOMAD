import express, { Request, Response } from 'express';
import { authenticate, adminOnly } from '../middleware/auth';
import { AuthRequest } from '../types';
import * as categoryService from '../services/categoryService';

const router = express.Router();

router.get('/', authenticate, (_req: Request, res: Response) => {
  res.json({ categories: categoryService.listCategories() });
});

router.post('/', authenticate, adminOnly, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { name, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  const category = categoryService.createCategory(authReq.user.id, name, color, icon);
  res.status(201).json({ category });
});

router.put('/:id', authenticate, adminOnly, (req: Request, res: Response) => {
  const { name, color, icon } = req.body;
  if (!categoryService.getCategoryById(req.params.id))
    return res.status(404).json({ error: 'Category not found' });
  const category = categoryService.updateCategory(req.params.id, name, color, icon);
  res.json({ category });
});

router.delete('/:id', authenticate, adminOnly, (req: Request, res: Response) => {
  if (!categoryService.getCategoryById(req.params.id))
    return res.status(404).json({ error: 'Category not found' });
  categoryService.deleteCategory(req.params.id);
  res.json({ success: true });
});

export default router;
