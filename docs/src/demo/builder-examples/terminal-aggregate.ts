import { from } from '@andreadito/pipequery-lang/builder';

type Employee = {
  salary: number;
};

export default from<Employee>('users').avg((employee) => employee.salary);