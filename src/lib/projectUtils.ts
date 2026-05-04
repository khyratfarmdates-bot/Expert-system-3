import { Project } from '../types';

export const calculateProjectProgress = (project: Project): number => {
  if (!project || !project.milestones || project.milestones.length === 0) return 0;
  
  let totalWeight = 0;
  let completedWeight = 0;

  project.milestones.forEach(m => {
    const weight = m.weight || 0;
    totalWeight += weight;
    if (m.status === 'completed') {
      completedWeight += weight;
    } else if (m.status === 'in-progress' || m.status === 'review-requested') {
      completedWeight += (weight * 0.5);
    }
  });

  if (totalWeight === 0) return 0;
  return Math.round((completedWeight / totalWeight) * 100);
};
