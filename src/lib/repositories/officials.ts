import type { GovernmentLevel, OfficeFunction } from '@prisma/client';
import { db } from '../db';

export const MAY_2026_BASELINE_AS_OF = new Date('2026-05-17T23:59:59.999Z');

type OfficialRosterOptions = {
  asOf?: Date;
  geographyId?: string;
  officeFunction?: OfficeFunction;
  governmentLevel?: GovernmentLevel;
  includeNonCurrentRows?: boolean;
};

export function getOfficialTenureWindow(asOf = MAY_2026_BASELINE_AS_OF) {
  return {
    startDate: {
      lte: asOf
    },
    OR: [
      {
        endDate: null
      },
      {
        endDate: {
          gte: asOf
        }
      }
    ]
  };
}

export async function listOfficialsAsOf({
  asOf = MAY_2026_BASELINE_AS_OF,
  geographyId,
  officeFunction,
  governmentLevel,
  includeNonCurrentRows = false
}: OfficialRosterOptions = {}) {
  return db.officialTenure.findMany({
    where: {
      ...getOfficialTenureWindow(asOf),
      ...(includeNonCurrentRows ? {} : { isCurrent: true }),
      office: {
        ...(geographyId ? { geographyId } : {}),
        ...(officeFunction ? { function: officeFunction } : {}),
        ...(governmentLevel ? { level: governmentLevel } : {})
      }
    },
    include: {
      person: true,
      party: true,
      office: {
        include: {
          geography: true,
          organization: true
        }
      }
    },
    orderBy: [
      {
        office: {
          level: 'asc'
        }
      },
      {
        office: {
          name: 'asc'
        }
      },
      {
        person: {
          lastName: 'asc'
        }
      },
      {
        person: {
          firstName: 'asc'
        }
      }
    ]
  });
}
