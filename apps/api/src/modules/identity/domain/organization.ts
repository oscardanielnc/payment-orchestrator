import { InvalidOrganizationNameError } from './errors';

export interface OrganizationProps {
  id: string;
  name: string;
  createdAt: Date;
}

export class Organization {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly createdAt: Date,
  ) {}

  static create(input: { id: string; name: string; now: Date }): Organization {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 100) throw new InvalidOrganizationNameError();
    return new Organization(input.id, name, input.now);
  }

  /** Rebuilds an organization already validated and stored. */
  static restore(props: OrganizationProps): Organization {
    return new Organization(props.id, props.name, props.createdAt);
  }
}
